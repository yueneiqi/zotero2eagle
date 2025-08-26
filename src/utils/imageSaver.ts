import { getPref } from "./prefs";

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
  static log(msg: string) {
    Zotero.debug("zotero2eagle-ImageSaver: " + msg);
  }

  static async saveAnnotationImage(
    item: any,
    annotationData: ImageAnnotationData,
  ): Promise<boolean> {
    try {
      const outputDir = getPref("outputDirectory") as string;
      if (!outputDir || outputDir.trim() === "") {
        this.log("No output directory configured, skipping image save");
        return false;
      }

      if (!item || !item.isAnnotation()) {
        this.log("Invalid item provided - not an annotation");
        return false;
      }

      const imageData = await this.extractImageFromAnnotation(item);
      if (!imageData) {
        this.log("No image data found in annotation");
        return false;
      }

      const filePath = await this.saveImageToDirectory(
        imageData,
        outputDir,
        annotationData,
      );
      
      if (filePath) {
        this.log(`Image saved successfully to: ${filePath}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.log(`Error saving annotation image: ${error}`);
      return false;
    }
  }

  private static async extractImageFromAnnotation(item: any): Promise<string | null> {
    try {
      if (item.annotationType !== "image") {
        return null;
      }

      this.log("Attempting to extract image from annotation");

      // In Zotero 7+, image annotations may have associated image data
      // Check if the annotation has an image property in its annotation data
      try {
        const annotationData = item.annotationData;
        if (annotationData && annotationData.image) {
          this.log("Found image data in annotation.annotationData.image");
          return annotationData.image;
        }
      } catch (e) {
        this.log(`No annotationData.image found: ${e}`);
      }

      // Try to get image data from annotation comment or text
      const annotationComment = item.annotationComment;
      if (annotationComment && annotationComment.startsWith("data:image/")) {
        this.log("Found image data in annotation comment");
        return annotationComment;
      }

      // Try annotation text field
      const annotationText = item.annotationText;
      if (annotationText && annotationText.startsWith("data:image/")) {
        this.log("Found image data in annotation text");
        return annotationText;
      }

      // Check for child attachments (less likely but possible)
      const attachments = await item.getAttachments();
      if (attachments && attachments.length > 0) {
        this.log(`Found ${attachments.length} attachments, checking for images`);
        for (const attachmentID of attachments) {
          const attachment = await Zotero.Items.getAsync(attachmentID);
          if (attachment && (attachment as any).attachmentMIMEType?.startsWith("image/")) {
            const file = (attachment as any).getFile();
            if (file && await file.exists()) {
              this.log(`Reading image file: ${file.path}`);
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
      this.log(`Annotation properties: ${Object.keys(item).join(", ")}`);
      this.log(`Annotation type: ${item.annotationType}, hasText: ${!!item.annotationText}, hasComment: ${!!item.annotationComment}`);
      
      this.log("No image data found in annotation");
      return null;
    } catch (error) {
      this.log(`Error extracting image from annotation: ${error}`);
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
        this.log(`Output path is not a directory: ${outputDir}`);
        return null;
      }

      // Extract base64 data and determine file extension
      const matches = imageDataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) {
        this.log("Invalid image data URL format");
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
      
      this.log(`Saved image: ${filename}`);
      return filePath;
    } catch (error) {
      this.log(`Error saving image to directory: ${error}`);
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
      this.log(`Error getting parent item metadata: ${error}`);
      return {};
    }
  }
}