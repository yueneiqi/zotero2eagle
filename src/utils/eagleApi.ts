import { FileLogger } from "./fileLogger";

export interface EagleItemFromURL {
  url: string;
  name: string;
  tags?: string[];
  rating?: number;
  annotation?: string;
  modificationTime?: number;
  folderId?: string;
  headers?: Record<string, string>;
}

export interface EagleItemFromPath {
  path: string;
  name: string;
  website?: string;
  annotation?: string;
  tags?: string[];
  folderId?: string;
}

export interface EagleApiResponse {
  status: "success" | "error";
  data?: any;
  message?: string;
}

export class EagleApi {
  private static readonly BASE_URL = "http://localhost:41595";
  private static readonly TIMEOUT = 10000; // 10 seconds

  static async log(
    msg: string,
    level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO",
  ) {
    await FileLogger.log(level, "EagleApi", msg);
  }

  static async isEagleRunning(): Promise<boolean> {
    try {
      const response = await this.makeRequest("/api/application/info", "GET");
      return response.status === "success";
    } catch (error) {
      await this.log("Eagle application not running or not accessible", "WARN");
      return false;
    }
  }

  static async addItemFromURL(
    item: EagleItemFromURL,
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding item to Eagle: ${item.name}`);

      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest(
        "/api/item/addFromURL",
        "POST",
        item,
      );

      if (response.status === "success") {
        await this.log(`Successfully added item to Eagle: ${item.name}`);
      } else {
        await this.log(
          `Failed to add item to Eagle: ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      const errorMsg = `Error adding item to Eagle: ${error}`;
      await this.log(errorMsg, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
  }

  static async addItemFromPath(
    item: EagleItemFromPath,
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding item from path to Eagle: ${item.name}`);

      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest(
        "/api/item/addFromPath",
        "POST",
        item,
      );

      if (response.status === "success") {
        await this.log(
          `Successfully added item from path to Eagle: ${item.name}`,
        );
      } else {
        await this.log(
          `Failed to add item from path to Eagle: ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      const errorMsg = `Error adding item from path to Eagle: ${error}`;
      await this.log(errorMsg, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
  }

  static async addItemsFromURLs(
    items: EagleItemFromURL[],
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding ${items.length} items to Eagle`);

      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest("/api/item/addFromURLs", "POST", {
        items,
      });

      if (response.status === "success") {
        await this.log(`Successfully added ${items.length} items to Eagle`);
      } else {
        await this.log(
          `Failed to add items to Eagle: ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      const errorMsg = `Error adding items to Eagle: ${error}`;
      await this.log(errorMsg, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
  }

  static async addItemsFromPaths(
    items: EagleItemFromPath[],
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding ${items.length} items from paths to Eagle`);

      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest(
        "/api/item/addFromPaths",
        "POST",
        { items },
      );

      if (response.status === "success") {
        await this.log(
          `Successfully added ${items.length} items from paths to Eagle`,
        );
      } else {
        await this.log(
          `Failed to add items from paths to Eagle: ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      const errorMsg = `Error adding items from paths to Eagle: ${error}`;
      await this.log(errorMsg, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
  }

  private static async makeRequest(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    data?: any,
  ): Promise<EagleApiResponse> {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        const url = `${this.BASE_URL}${endpoint}`;

        xhr.open(method, url);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.timeout = this.TIMEOUT;

        xhr.onload = function () {
          try {
            const response = JSON.parse(xhr.responseText || "{}");
            resolve(response);
          } catch (parseError) {
            reject(new Error(`Invalid JSON response: ${parseError}`));
          }
        };

        xhr.onerror = function () {
          reject(
            new Error(
              `Network error: ${xhr.statusText || "Connection failed"}`,
            ),
          );
        };

        xhr.ontimeout = function () {
          reject(new Error(`Request timeout after ${EagleApi.TIMEOUT}ms`));
        };

        if (method === "POST" && data) {
          xhr.send(JSON.stringify(data));
        } else {
          xhr.send();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  static generateZoteroItemUrl(
    itemKey: string,
    libraryType: string = "user",
  ): string {
    // Generate Zotero web library URL for the item
    // Format: zotero://select/library/items/{itemKey}
    return `zotero://select/library/items/${itemKey}`;
  }

  static generateZoteroWebUrl(itemKey: string, userId?: string): string {
    // Generate web URL for Zotero item
    if (userId) {
      return `https://www.zotero.org/${userId}/items/${itemKey}`;
    } else {
      // Fallback to local Zotero URI
      return `zotero://select/library/items/${itemKey}`;
    }
  }
}
