import { getPref } from "./prefs";
import { FileLogger } from "./fileLogger";

export interface ImageAnnotationData {
  annotationId: string;
  annotationType: string;
  itemId: string;
  itemKey: string;
  pageNumber: string;
  title?: string;
  authors?: string[];
  year?: string;
}

export class ImageSaver {
  static async log(msg: string, level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO") {
    await FileLogger.log(level, "ImageSaver", msg);
  }

  static async saveAnnotationImage(
    item: any,
    annotationData: ImageAnnotationData,
  ): Promise<boolean> {
    await FileLogger.initializeLogger();
    
    try {
      await this.log(`Starting image save for annotation ${annotationData.annotationId}`);
      
      const outputDir = getPref("outputDirectory") as string;
      if (!outputDir || outputDir.trim() === "") {
        await this.log("No output directory configured, skipping image save", "WARN");
        return false;
      }

      // Expand tilde (~) to home directory if present
      let expandedOutputDir = outputDir;
      if (outputDir.startsWith('~')) {
        try {
          // Use OS-specific approach to get home directory
          const os = Zotero.isWin ? 'win' : (Zotero.isMac ? 'mac' : 'linux');
          let homePath = '';
          
          if (os === 'win') {
            homePath = (Components as any).classes["@mozilla.org/file/directory_service;1"]
              .getService((Components as any).interfaces.nsIProperties)
              .get("Home", (Components as any).interfaces.nsIFile).path;
          } else {
            // Unix-like systems (Mac, Linux)
            homePath = (Components as any).classes["@mozilla.org/file/directory_service;1"]
              .getService((Components as any).interfaces.nsIProperties)  
              .get("Home", (Components as any).interfaces.nsIFile).path;
          }
          
          expandedOutputDir = outputDir.replace('~', homePath);
        } catch (e) {
          await this.log(`Failed to expand home directory: ${e}`, "WARN");
        }
      }

      await this.log(`Output directory configured: ${outputDir} (expanded: ${expandedOutputDir})`);

      if (!item || !item.isAnnotation()) {
        await this.log("Invalid item provided - not an annotation", "ERROR");
        return false;
      }

      const imageData = await this.extractImageFromAnnotation(item);
      if (!imageData) {
        await this.log("No image data found in annotation", "WARN");
        await FileLogger.logImageSaveEvent(false, annotationData.annotationId, undefined, "No image data found");
        return false;
      }

      await this.log(`Extracted image data, size: ${imageData.length} characters`);

      const filePath = await this.saveImageToDirectory(
        imageData,
        expandedOutputDir,
        annotationData,
      );
      
      if (filePath) {
        const filename = filePath.split(/[/\\]/).pop() || "unknown";
        await this.log(`Image saved successfully to: ${filePath}`);
        await FileLogger.logImageSaveEvent(true, annotationData.annotationId, filename);
        return true;
      }
      
      await FileLogger.logImageSaveEvent(false, annotationData.annotationId, undefined, "Failed to save to directory");
      return false;
    } catch (error) {
      const errorMsg = `Error saving annotation image: ${error}`;
      await this.log(errorMsg, "ERROR");
      await FileLogger.logImageSaveEvent(false, annotationData.annotationId, undefined, String(error));
      return false;
    }
  }

  private static async extractImageFromAnnotation(item: any): Promise<string | null> {
    try {
      if (item.annotationType !== "image") {
        return null;
      }

      await this.log("Attempting to extract image from annotation");

      // First, try to access the internal _annotationImage property
      const _annotationImage = (item as any)._annotationImage;
      await this.log(`Checking _annotationImage: ${_annotationImage ? `exists, type: ${typeof _annotationImage}, length: ${_annotationImage.length || 'N/A'}` : 'null/undefined'}`, "DEBUG");
      if (_annotationImage) {
        await this.log("Found image data in item._annotationImage");
        return _annotationImage;
      }

      // Try the public annotationImage property
      const annotationImage = item.annotationImage;
      await this.log(`Checking annotationImage: ${annotationImage ? `exists, type: ${typeof annotationImage}, length: ${annotationImage.length || 'N/A'}` : 'null/undefined'}`, "DEBUG");
      if (annotationImage) {
        await this.log("Found image data in item.annotationImage");
        return annotationImage;
      }

      // In Zotero 7+, image annotations may have associated image data
      // Check if the annotation has an image property in its annotation data
      try {
        const annotationData = item.annotationData;
        if (annotationData && annotationData.image) {
          await this.log("Found image data in annotation.annotationData.image");
          return annotationData.image;
        }
      } catch (e) {
        await this.log(`No annotationData.image found: ${e}`, "DEBUG");
      }

      // Try to get image data from annotation comment or text
      const annotationComment = item.annotationComment;
      if (annotationComment && annotationComment.startsWith("data:image/")) {
        await this.log("Found image data in annotation comment");
        return annotationComment;
      }

      // Try annotation text field
      const annotationText = item.annotationText;
      if (annotationText && annotationText.startsWith("data:image/")) {
        await this.log("Found image data in annotation text");
        return annotationText;
      }

      // Try to get image data using Zotero's annotation methods
      try {
        // Check if the annotation has a getAnnotationImage method
        if (typeof (item as any).getAnnotationImage === 'function') {
          await this.log("Trying item.getAnnotationImage() method");
          const imageData = await (item as any).getAnnotationImage();
          if (imageData) {
            await this.log(`Got image data from getAnnotationImage: ${typeof imageData}, length: ${imageData.length || 'N/A'}`);
            return imageData;
          }
        }

        // Check if there's an image property in the annotation's JSON representation
        const jsonData = item.toJSON ? item.toJSON() : null;
        if (jsonData && jsonData.annotationImage) {
          await this.log("Found image in toJSON().annotationImage");
          return jsonData.annotationImage;
        }
      } catch (e) {
        await this.log(`Error trying annotation methods: ${e}`, "DEBUG");
      }

      // Check for child attachments (less likely but possible)
      const attachments = await item.getAttachments();
      if (attachments && attachments.length > 0) {
        await this.log(`Found ${attachments.length} attachments, checking for images`);
        for (const attachmentID of attachments) {
          const attachment = await Zotero.Items.getAsync(attachmentID);
          if (attachment && (attachment as any).attachmentMIMEType?.startsWith("image/")) {
            const file = (attachment as any).getFile();
            if (file && await file.exists()) {
              await this.log(`Reading image file: ${file.path}`);
              const data = await Zotero.File.getBinaryContentsAsync(file.path);
              const uint8Array = new Uint8Array(data as unknown as ArrayBuffer);
              const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
              const mimeType = (attachment as any).attachmentMIMEType || "image/png";
              return `data:${mimeType};base64,${base64}`;
            }
          }
        }
      }

      // For debugging, log what properties the annotation has
      await this.log(`Annotation properties: ${Object.keys(item).join(", ")}`, "DEBUG");
      await this.log(`Annotation type: ${item.annotationType}, hasText: ${!!item.annotationText}, hasComment: ${!!item.annotationComment}`, "DEBUG");
      
      // Check for various image-related properties
      const imageProps = [
        '_annotationImage', 'annotationImage', '_image', 'image',
        'annotationData', '_annotationData', 'data', '_data'
      ];
      
      for (const prop of imageProps) {
        const value = (item as any)[prop];
        if (value !== undefined && value !== null) {
          const valueType = typeof value;
          let valueInfo = `${valueType}`;
          
          if (valueType === 'string') {
            valueInfo += `(${value.length} chars)${value.startsWith('data:') ? ' [data URL]' : ''}`;
            // Show first 100 chars for debugging
            if (value.length > 0) {
              valueInfo += ` - starts with: "${value.substring(0, 100)}..."`;
            }
          } else if (valueType === 'object' && value !== null) {
            valueInfo += ` - keys: [${Object.keys(value).join(', ')}]`;
          }
          
          await this.log(`Found property ${prop}: ${valueInfo}`, "DEBUG");
          
          // If it's a string and looks like image data, try to return it
          if (valueType === 'string' && value.startsWith('data:image/')) {
            await this.log(`Using ${prop} as image data source`);
            return value;
          }
        } else {
          await this.log(`Property ${prop}: ${value}`, "DEBUG");
        }
      }
      
      await this.log("No image data found in annotation", "WARN");
      return null;
    } catch (error) {
      await this.log(`Error extracting image from annotation: ${error}`, "ERROR");
      return null;
    }
  }

  private static async saveImageToDirectory(
    imageDataUrl: string,
    outputDir: string,
    annotationData: ImageAnnotationData,
  ): Promise<string | null> {
    try {
      // Validate and create directory if it doesn't exist
      const outputDirNS = Zotero.File.pathToFile(outputDir);
      if (!outputDirNS.exists()) {
        outputDirNS.create((Components.interfaces as any).nsIFile.DIRECTORY_TYPE || 1, 0o755);
      }

      if (!outputDirNS.isDirectory()) {
        await this.log(`Output path is not a directory: ${outputDir}`, "ERROR");
        return null;
      }

      // Extract base64 data and determine file extension
      const matches = imageDataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) {
        await this.log("Invalid image data URL format", "ERROR");
        return null;
      }

      const [, extension, base64Data] = matches;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeTitle = this.sanitizeFileName(
        annotationData.title || "Unknown",
      );
      const filename = `${safeTitle}_${annotationData.itemKey}_p${annotationData.pageNumber}_${timestamp}.${extension}`;

      // Create full file path - use OS-appropriate path separator
      const separator = Zotero.isWin ? "\\" : "/";
      const filePath = `${outputDir}${separator}${filename}`;
      
      // Write file
      await Zotero.File.putContentsAsync(filePath, bytes.buffer);
      
      await this.log(`Saved image: ${filename}`);
      return filePath;
    } catch (error) {
      await this.log(`Error saving image to directory: ${error}`, "ERROR");
      return null;
    }
  }

  private static sanitizeFileName(filename: string): string {
    // Remove or replace invalid filename characters
    return filename
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 50); // Limit length
  }

  static async getParentItemMetadata(annotationItem: any): Promise<{
    title?: string;
    authors?: string[];
    year?: string;
  }> {
    try {
      const parentItem = annotationItem.parentItem;
      if (!parentItem) {
        return {};
      }

      const title = parentItem.getField("title") || "Unknown";
      const creators = parentItem.getCreators();
      const authors = creators
        .filter((creator: any) => creator.creatorType === "author")
        .map((creator: any) => {
          if (creator.name) {
            return creator.name;
          }
          return [creator.firstName, creator.lastName]
            .filter(Boolean)
            .join(" ");
        });

      const year = parentItem.getField("year") || parentItem.getField("date")?.substring(0, 4) || "";

      return { title, authors, year };
    } catch (error) {
      await this.log(`Error getting parent item metadata: ${error}`, "ERROR");
      return {};
    }
  }
}