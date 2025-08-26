import { getPref } from "./prefs";

export class FileLogger {
  private static logFilePath: string | null = null;

  static async initializeLogger(): Promise<void> {
    try {
      const outputDir = getPref("outputDirectory") as string;
      if (outputDir && outputDir.trim() !== "") {
        // Create logs subdirectory in output directory
        const outputDirNS = Zotero.File.pathToFile(outputDir);
        if (!outputDirNS.exists()) {
          outputDirNS.create((Components.interfaces as any).nsIFile.DIRECTORY_TYPE || 1, 0o755);
        }

        const logsDir = outputDirNS.clone();
        logsDir.append("logs");
        if (!logsDir.exists()) {
          logsDir.create((Components.interfaces as any).nsIFile.DIRECTORY_TYPE || 1, 0o755);
        }

        // Set log file path with date
        const today = new Date().toISOString().split('T')[0];
        const separator = Zotero.isWin ? "\\" : "/";
        this.logFilePath = `${logsDir.path}${separator}zotero2eagle_${today}.log`;
      }
    } catch (error) {
      console.error("Failed to initialize file logger:", error);
      this.logFilePath = null;
    }
  }

  static async log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", module: string, message: string): Promise<void> {
    try {
      // Always log to Zotero debug console
      Zotero.debug(`zotero2eagle-${module}: [${level}] ${message}`);

      // Also log to file if configured
      if (this.logFilePath) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] [${module}] ${message}\n`;

        try {
          // Append to existing file by reading current content first
          let existingContent = "";
          try {
            const fileExists = await Zotero.File.pathToFile(this.logFilePath).exists();
            if (fileExists) {
              existingContent = await Zotero.File.getContentsAsync(this.logFilePath) as string;
            }
          } catch (e) {
            // File doesn't exist or can't be read, start with empty content
          }
          await Zotero.File.putContentsAsync(this.logFilePath, existingContent + logEntry);
        } catch (fileError) {
          // If file logging fails, at least log to console
          console.warn("Failed to write to log file:", fileError);
        }
      }
    } catch (error) {
      // Fallback to console if everything else fails
      console.error("Logger error:", error);
    }
  }

  static async info(module: string, message: string): Promise<void> {
    await this.log("INFO", module, message);
  }

  static async warn(module: string, message: string): Promise<void> {
    await this.log("WARN", module, message);
  }

  static async error(module: string, message: string): Promise<void> {
    await this.log("ERROR", module, message);
  }

  static async debug(module: string, message: string): Promise<void> {
    await this.log("DEBUG", module, message);
  }

  static async logImageSaveEvent(
    success: boolean, 
    annotationId: string, 
    filename?: string, 
    error?: string
  ): Promise<void> {
    const status = success ? "SUCCESS" : "FAILED";
    const details = success 
      ? `Saved annotation ${annotationId} as ${filename}`
      : `Failed to save annotation ${annotationId}: ${error}`;
    
    await this.log(success ? "INFO" : "ERROR", "ImageSaver", `[${status}] ${details}`);
  }

  static getLogFilePath(): string | null {
    return this.logFilePath;
  }

  static async rotateLogFile(): Promise<void> {
    if (!this.logFilePath) return;

    try {
      const logFile = Zotero.File.pathToFile(this.logFilePath);
      if (logFile.exists()) {
        const contents = await Zotero.File.getContentsAsync(this.logFilePath) as string;
        // Rotate if log file is larger than 10MB
        if (contents && contents.length > 10 * 1024 * 1024) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const rotatedPath = this.logFilePath.replace(".log", `_${timestamp}.log`);
          
          // Copy current log to rotated file
          await Zotero.File.putContentsAsync(rotatedPath, contents);
          
          // Clear current log file
          await Zotero.File.putContentsAsync(this.logFilePath, "");
          
          await this.info("FileLogger", `Log file rotated to ${rotatedPath}`);
        }
      }
    } catch (error) {
      console.error("Failed to rotate log file:", error);
    }
  }
}