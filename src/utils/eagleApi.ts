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
  private static readonly DEFAULT_BASE_URL = "http://localhost:41595";
  private static readonly TIMEOUT = 10000; // 10 seconds

  static async log(
    msg: string,
    level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO",
  ) {
    await FileLogger.log(level, "EagleApi", msg);
  }

  static async isEagleRunning(
    baseUrl: string = EagleApi.DEFAULT_BASE_URL,
    apiToken?: string,
  ): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        baseUrl,
        "/api/application/info",
        "GET",
        undefined,
        apiToken,
      );
      return response.status === "success";
    } catch (error) {
      await this.log("Eagle application not running or not accessible", "WARN");
      return false;
    }
  }

  static async addItemFromURL(
    item: EagleItemFromURL,
    baseUrl: string = EagleApi.DEFAULT_BASE_URL,
    apiToken?: string,
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding item to Eagle: ${item.name}`);

      if (!(await this.isEagleRunning(baseUrl, apiToken))) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest(
        baseUrl,
        "/api/item/addFromURL",
        "POST",
        item,
        apiToken,
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
    baseUrl: string = EagleApi.DEFAULT_BASE_URL,
    apiToken?: string,
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding item from path to Eagle: ${item.name}`);

      if (!(await this.isEagleRunning(baseUrl, apiToken))) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest(
        baseUrl,
        "/api/item/addFromPath",
        "POST",
        item,
        apiToken,
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
    baseUrl: string = EagleApi.DEFAULT_BASE_URL,
    apiToken?: string,
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding ${items.length} items to Eagle`);

      if (!(await this.isEagleRunning(baseUrl, apiToken))) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest(
        baseUrl,
        "/api/item/addFromURLs",
        "POST",
        { items },
        apiToken,
      );

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
    baseUrl: string = EagleApi.DEFAULT_BASE_URL,
    apiToken?: string,
  ): Promise<EagleApiResponse> {
    try {
      await this.log(`Adding ${items.length} items from paths to Eagle`);

      if (!(await this.isEagleRunning(baseUrl, apiToken))) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.makeRequest(
        baseUrl,
        "/api/item/addFromPaths",
        "POST",
        { items },
        apiToken,
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
    baseUrl: string,
    endpoint: string,
    method: "GET" | "POST" = "GET",
    data?: any,
    apiToken?: string,
  ): Promise<EagleApiResponse> {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        const base = (baseUrl || EagleApi.DEFAULT_BASE_URL).replace(/\/$/, "");
        const url = `${base}${endpoint}`;

        xhr.open(method, url);
        xhr.setRequestHeader("Content-Type", "application/json");
        if (apiToken) {
          xhr.setRequestHeader("Authorization", `Bearer ${apiToken}`);
        }
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
    pageNumber?: string,
    annotationId?: string,
    libraryType: string = "library",
  ): string {
    // Generate Zotero PDF URL with page and annotation
    // Format: zotero://open-pdf/library/items/{itemKey}?page={page}&annotation={annotationId}
    let url = `zotero://open-pdf/${libraryType}/items/${itemKey}`;

    const params = [];
    if (pageNumber) {
      params.push(`page=${pageNumber}`);
    }
    if (annotationId) {
      params.push(`annotation=${annotationId}`);
    }

    if (params.length > 0) {
      url += `?${params.join("&")}`;
    }

    return url;
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

/**
 * Test connectivity to an Eagle API endpoint using a provided base URL and token.
 * Returns a success flag and optional error message. Includes a timeout.
 */
export async function testEagleConnection(
  apiUrl: string,
  apiToken: string,
  timeoutMs = 8000,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiUrl) return { success: false, error: "API URL is required" };
    if (!apiToken) return { success: false, error: "API token is required" };

    const endpoint = `${apiUrl.replace(/\/$/, "")}/api/application/info`;

    const data = await new Promise<any>((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        let settled = false;
        const settle = (fn: (v?: any) => void, v?: any) => {
          if (!settled) {
            settled = true;
            fn(v);
          }
        };

        const timer = setTimeout(() => {
          try {
            xhr.abort();
          } catch (err) {
            // ignore abort errors
          }
          settle(reject, new Error(`Request timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        xhr.open("GET", endpoint, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Authorization", `Bearer ${apiToken}`);

        xhr.onload = () => {
          clearTimeout(timer);
          try {
            const json = JSON.parse(xhr.responseText || "{}");
            if (xhr.status >= 200 && xhr.status < 300) {
              settle(resolve, json);
            } else if (xhr.status === 401) {
              settle(reject, new Error("Invalid API token"));
            } else if (xhr.status === 404) {
              settle(
                reject,
                new Error("Eagle API not found. Is Eagle running?"),
              );
            } else {
              settle(
                reject,
                new Error(`HTTP ${xhr.status}: ${xhr.statusText || "Error"}`),
              );
            }
          } catch (err) {
            settle(reject, new Error("Invalid JSON response"));
          }
        };

        xhr.onerror = () => {
          clearTimeout(timer);
          settle(reject, new Error("Network error: Connection failed"));
        };

        xhr.onabort = () => {
          clearTimeout(timer);
          settle(reject, new Error("Request aborted"));
        };

        xhr.send();
      } catch (err) {
        reject(err);
      }
    });

    if ((data as any)?.status === "success") {
      return { success: true };
    }
    return {
      success: false,
      error: (data as any)?.message || "Unknown API error",
    };
  } catch (error: any) {
    const msg = String(error?.message || error || "Connection failed");
    return { success: false, error: msg };
  }
}
