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

      await this.log("Attempting to extract image from annotation using Zotero's cache system");

      // Use Zotero's annotation system to get the image data
      // This is the correct way according to Zotero's source code
      try {
        // Method 1: Use Zotero.Annotations.toJSON() - the official way
        if (Zotero.Annotations && typeof Zotero.Annotations.toJSON === 'function') {
          await this.log("Trying Zotero.Annotations.toJSON() method");
          const jsonData = await Zotero.Annotations.toJSON(item);
          if (jsonData && jsonData.image) {
            await this.log(`Got image data via Zotero.Annotations.toJSON, length: ${jsonData.image.length}`);
            return jsonData.image;
          } else {
            await this.log("Zotero.Annotations.toJSON() returned no image data", "WARN");
          }
        } else {
          await this.log("Zotero.Annotations.toJSON() not available", "WARN");
        }

        // Method 2: Check if image exists in cache and read it directly
        if (Zotero.Annotations && typeof Zotero.Annotations.getCacheImagePath === 'function') {
          await this.log("Trying direct cache file access");
          const cachePath = Zotero.Annotations.getCacheImagePath(item);
          await this.log(`Cache path: ${cachePath}`);
          
          // Check if cache file exists
          if (await (Zotero as any).File.pathExists(cachePath)) {
            await this.log("Cache file exists, generating data URI");
            const dataUri = await Zotero.File.generateDataURI(cachePath, 'image/png');
            if (dataUri) {
              await this.log(`Generated data URI, length: ${dataUri.length}`);
              return dataUri;
            } else {
              await this.log("Failed to generate data URI from cache file", "WARN");
            }
          } else {
            await this.log("Cache file does not exist", "WARN");
          }
        } else {
          await this.log("Zotero.Annotations.getCacheImagePath() not available", "WARN");
        }

      } catch (e) {
        await this.log(`Error using Zotero.Annotations methods: ${e}`, "ERROR");
      }

      // Fallback: For debugging, check all properties to understand data structure
      await this.log("Fallback debugging - checking all annotation properties", "DEBUG");
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
            if (value.length > 0 && value.length < 200) {
              valueInfo += ` - content: "${value}"`;
            } else if (value.length > 0) {
              valueInfo += ` - starts with: "${value.substring(0, 100)}..."`;
            }
          }
          
          await this.log(`Property ${prop}: ${valueInfo}`, "DEBUG");
          
          // If it's a data URL, return it
          if (valueType === 'string' && value.startsWith('data:image/')) {
            await this.log(`Using ${prop} as image data source`);
            return value;
          }
        }
      }
      
      await this.log("No image data found - annotation cache may not be ready yet", "WARN");
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