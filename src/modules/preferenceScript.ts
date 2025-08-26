// Preferences script for Zotero2Eagle
import { getPref, setPref } from "../utils/prefs";

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  // See addon/content/preferences.xhtml onpaneload
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [],
      rows: [],
    };
  } else {
    addon.data.prefs.window = _window;
  }

  updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  // Initialize preference values from storage
  if (addon.data.prefs?.window == undefined) return;

  const document = addon.data.prefs.window.document;

  // Load current preference values
  const apiUrlElement = document.getElementById(
    "zotero-prefpane-zotero2eagle-api-url",
  ) as HTMLInputElement;
  const apiTokenElement = document.getElementById(
    "zotero-prefpane-zotero2eagle-api-token",
  ) as HTMLInputElement;
  const outputDirElement = document.getElementById(
    "zotero-prefpane-zotero2eagle-output-dir",
  ) as HTMLInputElement;

  if (apiUrlElement) {
    apiUrlElement.value =
      (getPref("eagleApiUrl") as string) || "http://localhost:41595";
  }

  if (apiTokenElement) {
    apiTokenElement.value = (getPref("eagleApiToken") as string) || "";
  }

  if (outputDirElement) {
    outputDirElement.value = (getPref("outputDirectory") as string) || "";
  }

  ztoolkit.log("Preference UI updated!");
}

function bindPrefEvents() {
  if (!addon.data.prefs?.window) return;

  const document = addon.data.prefs.window.document;

  // Bind Eagle API URL changes
  const apiUrlElement = document.getElementById(
    "zotero-prefpane-zotero2eagle-api-url",
  );
  apiUrlElement?.addEventListener("input", (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setPref("eagleApiUrl", value);
  });

  // Bind Eagle API Token changes
  const apiTokenElement = document.getElementById(
    "zotero-prefpane-zotero2eagle-api-token",
  );
  apiTokenElement?.addEventListener("input", (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setPref("eagleApiToken", value);
  });

  // Bind Output Directory changes
  const outputDirElement = document.getElementById(
    "zotero-prefpane-zotero2eagle-output-dir",
  );
  outputDirElement?.addEventListener("input", (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setPref("outputDirectory", value);
  });

  // Bind Test Connection button
  const testButton = document.getElementById("zotero2eagle-test-connection");
  const statusElement = document.getElementById(
    "zotero2eagle-connection-status",
  );

  testButton?.addEventListener("command", async (e: Event) => {
    if (!statusElement) return;

    const button = e.target as any;
    button.disabled = true;
    button.label = "Testing...";
    statusElement.textContent = "";
    (statusElement as HTMLElement).style.color = "";

    try {
      const apiUrl =
        (
          document.getElementById(
            "zotero-prefpane-zotero2eagle-api-url",
          ) as HTMLInputElement
        )?.value ||
        (getPref("eagleApiUrl") as string) ||
        "http://localhost:41595";
      const apiToken =
        (
          document.getElementById(
            "zotero-prefpane-zotero2eagle-api-token",
          ) as HTMLInputElement
        )?.value ||
        (getPref("eagleApiToken") as string) ||
        "";

      const result = await testEagleConnection(apiUrl, apiToken);

      if (result.success) {
        statusElement.textContent = "✓ Connection successful!";
        (statusElement as HTMLElement).style.color = "#28a745";
      } else {
        statusElement.textContent = `✗ ${result.error}`;
        (statusElement as HTMLElement).style.color = "#dc3545";
      }
    } catch (error: any) {
      statusElement.textContent = `✗ ${error.message || "Connection failed"}`;
      (statusElement as HTMLElement).style.color = "#dc3545";
    } finally {
      button.disabled = false;
      button.label = "Test Connection";
    }
  });
}

/**
 * Test Eagle API connection
 */
async function testEagleConnection(
  apiUrl: string,
  apiToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiUrl) {
      return { success: false, error: "API URL is required" };
    }

    if (!apiToken) {
      return { success: false, error: "API token is required" };
    }

    // Test connection with Eagle API
    const response = await fetch(`${apiUrl}/api/application/info`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "Invalid API token" };
      } else if (response.status === 404) {
        return {
          success: false,
          error: "Eagle API not found. Is Eagle running?",
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    }

    const data = await response.json();

    if ((data as any).status === "success") {
      return { success: true };
    } else {
      return {
        success: false,
        error: (data as any).message || "Unknown API error",
      };
    }
  } catch (error: any) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return {
        success: false,
        error: "Cannot connect to Eagle. Is it running?",
      };
    }
    return { success: false, error: error.message || "Connection failed" };
  }
}
