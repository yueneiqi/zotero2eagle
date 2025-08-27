import { FileLogger } from "./fileLogger";
import { getPref } from "./prefs";

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
  private static readonly EAGLE_PORT = 41595;
  private static EAGLE_HOST: string | null = null;
  private static readonly TIMEOUT = 10000; // 10 seconds

  static async log(
    msg: string,
    level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO",
  ) {
    await FileLogger.log(level, "EagleApi", msg);
  }

  private static async pickEagleHost(hosts: string[] = ['localhost', '[::1]', '127.0.0.1']): Promise<string> {
    if (this.EAGLE_HOST) return this.EAGLE_HOST;
    
    for (const host of hosts) {
      try {
        await Zotero.HTTP.request('GET', `http://${host}:${this.EAGLE_PORT}/api/application/info`, { 
          timeout: 1500 
        });
        this.EAGLE_HOST = host;
        return host;
      } catch (error: any) {
        // Treat 401 Unauthorized as reachable (host is up but requires auth)
        if (error && (error.status === 401 || error.code === 401)) {
          this.EAGLE_HOST = host;
          return host;
        }
      }
    }
    throw new Error('Eagle API not reachable (IPv6/IPv4/localhost all failed)');
  }

  static async buildEagleBaseUrl(rawUrl: string): Promise<string> {
    // Get base URL from preferences or use default
    const customApiUrl = rawUrl || "";
    
    if (customApiUrl.trim()) {
      // Use custom URL from preferences
      const cleanBaseUrl = customApiUrl.endsWith('/') ? customApiUrl.slice(0, -1) : customApiUrl;
      
      let urlObj: URL | null = null;
      try {
        urlObj = new URL(cleanBaseUrl);
      } catch (e) {
        // If invalid URL, just skip localhost logic and let the rest handle it
        urlObj = null;
      }
      // If the custom URL is localhost, try to pick the best host to avoid ipv6/ipv4 issue
      if (urlObj && urlObj.hostname === 'localhost') {
        const host = await this.pickEagleHost();
        return `http://${host}:${urlObj.port || this.EAGLE_PORT}`;
      }
      return cleanBaseUrl;
    }
    
    // Fallback: pick a host and use default port
    const host = await this.pickEagleHost();
    return `http://${host}:${this.EAGLE_PORT}`;
  }

  static async eagleRequest(baseUrl: string, path: string, init: any = {}, apiToken?: string): Promise<any> {
    try {
      let url = `${baseUrl}${path}`;
      let requestBody = init.body;
      
      // Include token in the request body for all request types if provided
      if (apiToken) {
        if (requestBody) {
          // If body is already an object, add token to it
          if (typeof requestBody === 'object' && requestBody !== null) {
            requestBody = { ...requestBody, token: apiToken };
          } else {
            // If body is a string, try to parse it and add token
            try {
              const bodyObj = JSON.parse(requestBody);
              requestBody = { ...bodyObj, token: apiToken };
            } catch {
              // If can't parse, fall back to query parameter
              const separator = path.includes('?') ? '&' : '?';
              url += `${separator}token=${encodeURIComponent(apiToken)}`;
            }
          }
        } else {
          // No existing body, create one with just the token
          requestBody = { token: apiToken };
        }
      }
    
      const res = await Zotero.HTTP.request(init.method || 'GET', url, {
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
        body: requestBody && (typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody)),
        responseType: init.responseType || 'json',
        timeout: init.timeout || this.TIMEOUT,
      });
      return res.response;
    } catch (error: any) {
      // Only log errors that aren't common auth/connection failures
      if (!(error && (error.status === 401 || error.code === 401))) {
        await this.log(`Request failed: ${error}`, "ERROR");
      }
      // Normalize 401 into a structured response so callers can detect Eagle running but unauthorized
      if (error && (error.status === 401 || error.code === 401)) {
        return { status: 'error', code: 401, message: 'Unauthorized' };
      }
      throw error;
    }
  }

  static async isEagleRunning(): Promise<boolean> {
    try {
      const rawUrl = (getPref("eagleApiUrl") as string) || "http://localhost:41595";
      const baseUrl = await this.buildEagleBaseUrl(rawUrl);
      await Zotero.HTTP.request('GET', `${baseUrl}/api/application/info`, { 
        timeout: 1500 
      });
      return true;
    } catch (error: any) {
      // Treat 401 Unauthorized as reachable (host is up but requires auth)
      if (error && (error.status === 401 || error.code === 401)) {
        return true;
      }
      return false;
    }
  }

  static async addItemFromURL(
    baseUrl: string,
    apiToken: string,
    item: EagleItemFromURL,
  ): Promise<EagleApiResponse> {
    try {
      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.eagleRequest(baseUrl, "/api/item/addFromURL", {
        method: "POST",
        body: item
      }, apiToken);

      if (response.status !== "success") {
        await this.log(
          `Failed to add item "${item.name}": ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      await this.log(`Error adding item "${item.name}": ${error}`, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
  }

  static async addItemFromPath(
    baseUrl: string,
    apiToken: string,
    item: EagleItemFromPath,
  ): Promise<EagleApiResponse> {
    try {
      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.eagleRequest(baseUrl, "/api/item/addFromPath", {
        method: "POST",
        body: item
      }, apiToken);

      if (response.status !== "success") {
        await this.log(
          `Failed to add item from path "${item.name}": ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      await this.log(`Error adding item from path "${item.name}": ${error}`, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
  }

  static async addItemsFromURLs(
    baseUrl: string,
    apiToken: string,
    items: EagleItemFromURL[],
  ): Promise<EagleApiResponse> {
    try {
      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.eagleRequest(baseUrl, "/api/item/addFromURLs", {
        method: "POST",
        body: { items }
      }, apiToken);

      if (response.status !== "success") {
        await this.log(
          `Failed to add ${items.length} items: ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      await this.log(`Error adding ${items.length} items: ${error}`, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
  }

  static async addItemsFromPaths(
    baseUrl: string,
    apiToken: string,
    items: EagleItemFromPath[],
  ): Promise<EagleApiResponse> {
    try {
      if (!(await this.isEagleRunning())) {
        throw new Error("Eagle application is not running");
      }

      const response = await this.eagleRequest(baseUrl, "/api/item/addFromPaths", {
        method: "POST",
        body: { items }
      }, apiToken);

      if (response.status !== "success") {
        await this.log(
          `Failed to add ${items.length} items from paths: ${response.message || "Unknown error"}`,
          "ERROR",
        );
      }

      return response;
    } catch (error) {
      await this.log(`Error adding ${items.length} items from paths: ${error}`, "ERROR");
      return {
        status: "error",
        message: String(error),
      };
    }
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
  baseUrl: string,
  apiToken: string,
  timeoutMs = 8000,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiToken) return { success: false, error: "API token is required" };

    const response = await EagleApi.eagleRequest(baseUrl, "/api/application/info", {
      timeout: timeoutMs
    }, apiToken);

    if (response?.status === "success") {
      return { success: true };
    }
    return {
      success: false,
      error: response?.message || "Unknown API error",
    };
  } catch (error: any) {
    let msg = "Connection failed";
    
    if (error.code === 401 || error.status === 401 || error.message?.includes("Unauthorized")) {
      msg = "Invalid API token";
    } else if (error.message?.includes("Eagle API not reachable")) {
      msg = "Eagle API not found. Is Eagle running?";
    } else if (error.message) {
      msg = String(error.message);
    }
    
    return { success: false, error: msg };
  }
}
