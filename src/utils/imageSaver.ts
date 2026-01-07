import { getPref } from "./prefs";
import { FileLogger } from "./fileLogger";
import { EagleApi, EagleItemFromPath, EagleApiResponse } from "./eagleApi";

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

export interface ImageSaveResult {
  success: boolean;
  eagleSaved: boolean;
  localSaved: boolean;
  message: string;
  filename?: string;
}

export class ImageSaver {
  private static getPathSeparator(): string {
    return Zotero.isWin ? "\\" : "/";
  }

  private static joinPath(basePath: string, ...parts: string[]): string {
    const separator = this.getPathSeparator();
    let path = basePath.replace(/[\\/]+$/, "");
    for (const part of parts) {
      const cleaned = part.replace(/^[\\/]+/, "");
      path = `${path}${separator}${cleaned}`;
    }
    return path;
  }

  private static getZoteroDataDirectory(): string | null {
    try {
      const dataDir = (Zotero as any).DataDirectory?.dir;
      if (dataDir && typeof dataDir === "string") {
        return dataDir;
      }
      const dataDirFile = (Zotero as any).DataDirectory?.get?.();
      if (dataDirFile?.path) {
        return dataDirFile.path;
      }
      const dataDirPath = (Zotero as any).DataDirectory?.getDirectory?.();
      if (typeof dataDirPath === "string") {
        return dataDirPath;
      }
    } catch (e) {
      // Fall through to default path
    }

    const homeDir = this.getHomeDirectory();
    if (!homeDir) return null;
    return this.joinPath(homeDir, "Zotero");
  }

  private static getCachePathCandidates(
    annotationId: string,
    item?: any,
  ): string[] {
    const candidates = new Set<string>();

    // Prefer Zotero's internal API when available
    try {
      const annotationsApi = (Zotero as any).Annotations;
      const getCachePath = annotationsApi?.getCacheImagePath;
      if (typeof getCachePath === "function") {
        const apiInputs = [item, annotationId].filter(Boolean);
        for (const input of apiInputs) {
          try {
            const apiPath = getCachePath(input);
            if (typeof apiPath === "string" && apiPath.trim()) {
              candidates.add(apiPath);
            }
          } catch (e) {
            // Ignore API failures and fall back to known paths
          }
        }
      }
    } catch (e) {
      // Ignore and fall back to known paths
    }

    const dataDir = this.getZoteroDataDirectory();
    if (dataDir) {
      const cacheRoot = this.joinPath(dataDir, "cache");
      const subDirs = ["library", "annotations"];
      const extensions = ["png", "jpg", "jpeg"];
      for (const subDir of subDirs) {
        for (const ext of extensions) {
          candidates.add(
            this.joinPath(cacheRoot, subDir, `${annotationId}.${ext}`),
          );
        }
      }
    }

    return Array.from(candidates);
  }

  static async log(
    msg: string,
    level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO",
  ) {
    await FileLogger.log(level, "ImageSaver", msg);
  }

  static async saveAnnotationImage(
    item: any,
    annotationData: ImageAnnotationData,
  ): Promise<ImageSaveResult> {
    await FileLogger.initializeLogger();

    try {
      await this.log(
        `Starting image save for annotation ${annotationData.annotationId}`,
      );

      // Get and expand output directory (optional for local backup)
      const expandedOutputDir = await this.expandOutputDirectory();

      if (!item || !item.isAnnotation()) {
        await this.log("Invalid item provided - not an annotation", "ERROR");
        return {
          success: false,
          eagleSaved: false,
          localSaved: false,
          message: "Invalid annotation item",
        };
      }

      let eagleSaved = false;
      let localSaved = false;

      // Try to save to Eagle first if integration is enabled (uses cache directly)
      const eagleIntegrationEnabled = getPref("enableEagleIntegration");
      if (eagleIntegrationEnabled) {
        eagleSaved = await this.saveToEagleDirect(item, annotationData);
      }

      // Only proceed with local backup if output directory is configured
      if (!expandedOutputDir || expandedOutputDir.trim() === "") {
        await this.log("No output directory configured, skipping local backup");

        // Return result based on Eagle status
        if (eagleIntegrationEnabled && eagleSaved) {
          return {
            success: true,
            eagleSaved: true,
            localSaved: false,
            message: "Image saved to Eagle",
          };
        } else if (eagleIntegrationEnabled && !eagleSaved) {
          return {
            success: false,
            eagleSaved: false,
            localSaved: false,
            message: "Failed to save to Eagle",
          };
        } else {
          await this.log(
            "Neither Eagle integration nor local backup is configured",
            "WARN",
          );
          return {
            success: false,
            eagleSaved: false,
            localSaved: false,
            message: "No save method configured",
          };
        }
      }

      const imageData = await this.extractImageFromAnnotation(item);
      if (!imageData) {
        await this.log("No image data found in annotation", "WARN");
        await FileLogger.logImageSaveEvent(
          false,
          annotationData.annotationId,
          undefined,
          "No image data found",
        );

        // Return result based on what succeeded
        if (eagleSaved) {
          return {
            success: true,
            eagleSaved: true,
            localSaved: false,
            message:
              "Image saved to Eagle (local backup failed: no image data)",
          };
        } else {
          return {
            success: false,
            eagleSaved: false,
            localSaved: false,
            message: "No image data found in annotation",
          };
        }
      }

      await this.log(
        `Extracted image data, size: ${imageData.length} characters`,
      );

      const filePath = await this.saveImageToDirectory(
        imageData,
        expandedOutputDir,
        annotationData,
        item,
      );

      if (filePath) {
        const filename = filePath.split(/[/\\]/).pop() || "unknown";
        await this.log(
          `Image saved successfully to local directory: ${filePath}`,
        );
        await FileLogger.logImageSaveEvent(
          true,
          annotationData.annotationId,
          filename,
        );
        localSaved = true;
      } else {
        await FileLogger.logImageSaveEvent(
          false,
          annotationData.annotationId,
          undefined,
          "Failed to save to directory",
        );
      }

      // Generate final result message based on what succeeded
      const success = eagleSaved || localSaved;
      let message = "";

      if (eagleSaved && localSaved) {
        message = "Image saved to Eagle and local directory";
      } else if (eagleSaved && !localSaved) {
        message = "Image saved to Eagle (local backup failed)";
      } else if (!eagleSaved && localSaved) {
        message = "Image saved to local directory (Eagle failed or disabled)";
      } else {
        message = "Failed to save image (both Eagle and local backup failed)";
      }

      return {
        success,
        eagleSaved,
        localSaved,
        message,
        filename: localSaved ? filePath?.split(/[/\\]/).pop() : undefined,
      };
    } catch (error) {
      const errorMsg = `Error saving annotation image: ${error}`;
      await this.log(errorMsg, "ERROR");
      await FileLogger.logImageSaveEvent(
        false,
        annotationData.annotationId,
        undefined,
        String(error),
      );
      return {
        success: false,
        eagleSaved: false,
        localSaved: false,
        message: `Error: ${error}`,
      };
    }
  }

  private static async waitForCacheImage(
    annotationId: string,
    item?: any,
    options?: {
      maxWaitTimeMs?: number;
      checkIntervalMs?: number;
      stableMs?: number;
    },
  ): Promise<string | null> {
    try {
      const {
        maxWaitTimeMs = 30000,
        checkIntervalMs = 250,
        stableMs = 500,
      } = options || {};

      const candidates = this.getCachePathCandidates(annotationId, item);
      if (candidates.length === 0) {
        await this.log("No cache path candidates resolved", "ERROR");
        return null;
      }

      await this.log(
        `Looking for cache file for annotation ${annotationId} (candidates: ${candidates.length})`,
      );

      const startTime = Date.now();
      const lastSizes = new Map<string, number>();
      const stableSince = new Map<string, number>();

      while (Date.now() - startTime < maxWaitTimeMs) {
        for (const cachePath of candidates) {
          try {
            const cacheFile = Zotero.File.pathToFile(cachePath);
            if (cacheFile.exists() && cacheFile.isFile()) {
              const fileSize = cacheFile.fileSize;
              if (fileSize > 0) {
                const previousSize = lastSizes.get(cachePath);
                if (previousSize === fileSize) {
                  if (!stableSince.has(cachePath)) {
                    stableSince.set(cachePath, Date.now());
                  }
                  const stableFor =
                    Date.now() - (stableSince.get(cachePath) || 0);
                  if (stableFor >= stableMs) {
                    await this.log(
                      `Cache file found after ${Date.now() - startTime}ms: ${cachePath}`,
                    );
                    return cachePath;
                  }
                } else {
                  lastSizes.set(cachePath, fileSize);
                  stableSince.set(cachePath, Date.now());
                }
              }
            }
          } catch (e) {
            // File doesn't exist yet, continue waiting
          }
        }

        await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
      }

      await this.log(
        `Cache file not found after ${maxWaitTimeMs}ms`,
        "WARN",
      );
      return null;
    } catch (error) {
      await this.log(`Error waiting for cache image: ${error}`, "ERROR");
      return null;
    }
  }

  private static getHomeDirectory(): string | null {
    try {
      // Get home directory using Zotero's cross-platform approach
      const homeDirFile = (Components as any).classes[
        "@mozilla.org/file/directory_service;1"
      ]
        .getService((Components as any).interfaces.nsIProperties)
        .get("Home", (Components as any).interfaces.nsIFile);

      return homeDirFile.path;
    } catch (e) {
      return null;
    }
  }

  private static async extractImageFromAnnotation(
    item: any,
  ): Promise<string | null> {
    try {
      if (item.annotationType !== "image") {
        return null;
      }

      const annotationId = item.key;
      await this.log(`Waiting for cache image for annotation ${annotationId}`);

      // Wait for the cache PNG file to be created
      const cachePath = await this.waitForCacheImage(annotationId, item);
      if (!cachePath) {
        await this.log("Cache image file not found", "WARN");
        return null;
      }

      // Read the cache file and convert to data URI
      try {
        const dataUri = await Zotero.File.generateDataURI(
          cachePath,
          "image/png",
        );
        if (dataUri) {
          await this.log(
            `Generated data URI from cache, length: ${dataUri.length}`,
          );
          return dataUri;
        } else {
          await this.log(
            "Failed to generate data URI from cache file",
            "ERROR",
          );
          return null;
        }
      } catch (e) {
        await this.log(`Error reading cache file: ${e}`, "ERROR");
        return null;
      }
    } catch (error) {
      await this.log(
        `Error extracting image from annotation: ${error}`,
        "ERROR",
      );
      return null;
    }
  }

  private static async copyFromCacheToOutput(
    annotationId: string,
    outputDir: string,
    annotationData: ImageAnnotationData,
    item?: any,
  ): Promise<string | null> {
    try {
      // Wait for cache file to be created
      const cachePath = await this.waitForCacheImage(annotationId, item);
      if (!cachePath) {
        await this.log("Cache file not available for copying", "ERROR");
        return null;
      }

      // Validate and create output directory if it doesn't exist
      const outputDirNS = Zotero.File.pathToFile(outputDir);
      if (!outputDirNS.exists()) {
        outputDirNS.create(
          (Components.interfaces as any).nsIFile.DIRECTORY_TYPE || 1,
          0o755,
        );
      }

      if (!outputDirNS.isDirectory()) {
        await this.log(`Output path is not a directory: ${outputDir}`, "ERROR");
        return null;
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeTitle = this.sanitizeFileName(
        annotationData.title || "Unknown",
      );
      const filename = `${safeTitle}_${annotationData.itemKey}_p${annotationData.pageNumber}_${timestamp}.png`;

      // Create full file path - use OS-appropriate path separator
      const separator = Zotero.isWin ? "\\" : "/";
      const destPath = `${outputDir}${separator}${filename}`;

      await this.log(`Copying from ${cachePath} to ${destPath}`);

      // Copy file using native nsIFile copy method
      try {
        const sourceFile = Zotero.File.pathToFile(cachePath);
        const destFile = Zotero.File.pathToFile(destPath);

        // Ensure destination directory exists
        const destParent = destFile.parent;
        if (!destParent.exists()) {
          destParent.create(
            (Components.interfaces as any).nsIFile.DIRECTORY_TYPE || 1,
            0o755,
          );
        }

        // Use native nsIFile.copyTo for binary-safe file copying
        sourceFile.copyTo(destParent, destFile.leafName);

        await this.log(
          "Successfully copied cache file to output directory using nsIFile.copyTo",
        );
      } catch (copyError) {
        await this.log(`File copy failed: ${copyError}`, "ERROR");
        throw copyError;
      }

      await this.log(`Saved image: ${filename}`);
      return destPath;
    } catch (error) {
      await this.log(`Error copying image to directory: ${error}`, "ERROR");
      return null;
    }
  }

  private static async saveImageToDirectory(
    imageDataUrl: string,
    outputDir: string,
    annotationData: ImageAnnotationData,
    item?: any,
  ): Promise<string | null> {
    // For compatibility, we'll try the direct copy method first
    // If that fails, fall back to the data URL method

    try {
      // Try direct copy from cache first (preferred method)
      const copyResult = await this.copyFromCacheToOutput(
        annotationData.annotationId,
        outputDir,
        annotationData,
        item,
      );
      if (copyResult) {
        return copyResult;
      }
    } catch (error) {
      await this.log(
        `Direct copy failed, falling back to data URL method: ${error}`,
        "WARN",
      );
    }

    // Fallback to data URL method
    try {
      // Validate and create directory if it doesn't exist
      const outputDirNS = Zotero.File.pathToFile(outputDir);
      if (!outputDirNS.exists()) {
        outputDirNS.create(
          (Components.interfaces as any).nsIFile.DIRECTORY_TYPE || 1,
          0o755,
        );
      }

      if (!outputDirNS.isDirectory()) {
        await this.log(`Output path is not a directory: ${outputDir}`, "ERROR");
        return null;
      }

      // Extract base64 data and determine file extension
      const matches = imageDataUrl.match(
        /^data:image\/([a-zA-Z]+);base64,(.+)$/,
      );
      if (!matches) {
        await this.log("Invalid image data URL format", "ERROR");
        return null;
      }

      const [, extension, base64Data] = matches;

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeTitle = this.sanitizeFileName(
        annotationData.title || "Unknown",
      );
      const filename = `${safeTitle}_${annotationData.itemKey}_p${annotationData.pageNumber}_${timestamp}.${extension}`;

      // Create full file path - use OS-appropriate path separator
      const separator = Zotero.isWin ? "\\" : "/";
      const filePath = `${outputDir}${separator}${filename}`;

      // Write file using Zotero's binary file API (following Zotero's pattern)
      await this.log(`Writing file to: ${filePath}`);

      // Convert base64 data to Uint8Array (following Zotero's reader.js and editorInstance.js pattern)
      await this.log("Converting base64 data to Uint8Array for binary writing");

      try {
        // Convert base64 to binary string, then to Uint8Array (Zotero's pattern)
        const binaryString = atob(base64Data);
        const u8arr = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          u8arr[i] = binaryString.charCodeAt(i);
        }

        await this.log(`Created Uint8Array with ${u8arr.length} bytes`);

        // Write directly using Zotero's file API
        await Zotero.File.putContentsAsync(filePath, u8arr.buffer);
        await this.log(
          "Successfully wrote image file using Zotero.File.putContentsAsync",
        );
      } catch (writeError) {
        await this.log(
          `Zotero.File.putContentsAsync failed: ${writeError}`,
          "ERROR",
        );
        throw writeError;
      }

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

      const year =
        parentItem.getField("year") ||
        parentItem.getField("date")?.substring(0, 4) ||
        "";

      return { title, authors, year };
    } catch (error) {
      await this.log(`Error getting parent item metadata: ${error}`, "ERROR");
      return {};
    }
  }

  private static async saveToEagleDirect(
    item: any,
    annotationData: ImageAnnotationData,
  ): Promise<boolean> {
    try {
      await this.log(
        "Attempting to save image to Eagle using cache path directly",
      );

      // Wait for cache image to be available
      const cachePath = await this.waitForCacheImage(
        annotationData.annotationId,
        item,
      );
      if (!cachePath) {
        await this.log(
          "Cache image not available, cannot save to Eagle",
          "WARN",
        );
        return false;
      }

      // Generate Zotero link for the item with page and annotation info
      const zoteroUrl = EagleApi.generateZoteroItemUrl(
        annotationData.itemKey,
        annotationData.pageNumber,
        annotationData.annotationId,
      );

      // Generate proper filename for Eagle
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeTitle = this.sanitizeFileName(
        annotationData.title || "Unknown",
      );
      const filename = `${safeTitle}_${annotationData.itemKey}_p${annotationData.pageNumber}_${timestamp}.png`;

      // Prepare Eagle item data using cache path directly
      const eagleItem: EagleItemFromPath = {
        path: cachePath,
        name: filename,
        website: zoteroUrl,
        annotation: this.generateEagleAnnotation(annotationData),
        tags: this.generateEagleTags(annotationData),
        folderId: getPref("eagleFolderId") || undefined,
      };

      // Save to Eagle
      const apiUrl = await EagleApi.buildEagleBaseUrl();
      const apiToken = ((getPref("eagleApiToken") as string) || "").trim();

      const response: EagleApiResponse = await EagleApi.addItemFromPath(
        apiUrl,
        apiToken,
        eagleItem,
      );

      if (response.status === "success") {
        await this.log("Successfully saved image to Eagle from cache");
        await FileLogger.log(
          "INFO",
          "ImageSaver",
          `Eagle integration: Image saved directly from cache for annotation ${annotationData.annotationId}`,
        );
        return true;
      } else {
        await this.log(
          `Failed to save image to Eagle: ${response.message}`,
          "WARN",
        );
        return false;
      }
    } catch (error) {
      await this.log(`Error saving to Eagle directly: ${error}`, "ERROR");
      return false;
    }
  }

  private static generateEagleAnnotation(
    annotationData: ImageAnnotationData,
  ): string {
    const parts = [];

    if (annotationData.title) {
      parts.push(`Title: ${annotationData.title}`);
    }

    if (annotationData.authors && annotationData.authors.length > 0) {
      parts.push(`Authors: ${annotationData.authors.join(", ")}`);
    }

    if (annotationData.year) {
      parts.push(`Year: ${annotationData.year}`);
    }

    parts.push(`Page: ${annotationData.pageNumber}`);
    parts.push(`Annotation ID: ${annotationData.annotationId}`);

    return parts.join(" | ");
  }

  private static generateEagleTags(
    annotationData: ImageAnnotationData,
  ): string[] {
    const tags = ["Zotero", "PDF", "Annotation"];

    if (annotationData.year) {
      tags.push(annotationData.year);
    }

    if (annotationData.authors && annotationData.authors.length > 0) {
      // Add first author's last name as a tag
      const firstAuthor = annotationData.authors[0];
      const lastNameMatch = firstAuthor.match(/\b(\w+)$/);
      if (lastNameMatch) {
        tags.push(lastNameMatch[1]);
      }
    }

    return tags;
  }

  // Helper method to get and expand the output directory
  private static async expandOutputDirectory(): Promise<string | null> {
    const outputDir = getPref("outputDirectory") as string;

    if (!outputDir || outputDir.trim() === "") {
      return null;
    }

    // Expand tilde (~) to home directory if present
    let expandedOutputDir = outputDir;
    if (outputDir.startsWith("~")) {
      try {
        // Use OS-specific approach to get home directory
        const os = Zotero.isWin ? "win" : Zotero.isMac ? "mac" : "linux";
        let homePath = "";

        if (os === "win") {
          homePath = (Components as any).classes[
            "@mozilla.org/file/directory_service;1"
          ]
            .getService((Components as any).interfaces.nsIProperties)
            .get("Home", (Components as any).interfaces.nsIFile).path;
        } else {
          // Unix-like systems (Mac, Linux)
          homePath = (Components as any).classes[
            "@mozilla.org/file/directory_service;1"
          ]
            .getService((Components as any).interfaces.nsIProperties)
            .get("Home", (Components as any).interfaces.nsIFile).path;
        }

        expandedOutputDir = outputDir.replace("~", homePath);
      } catch (e) {
        await this.log(`Failed to expand home directory: ${e}`, "WARN");
      }
    }

    await this.log(
      `Output directory configured: ${outputDir} (expanded: ${expandedOutputDir})`,
    );

    return expandedOutputDir;
  }
}
