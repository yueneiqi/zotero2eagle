// Preferences script for Zotero2Eagle
import { getPref, setPref } from "../utils/prefs";
import { testEagleConnection } from "../utils/eagleApi";
import { config } from "../../package.json";

const REF = config.addonRef;
const id = (suffix: string) => `zotero-prefpane-${REF}-${suffix}`;
const btn = (suffix: string) => `${REF}-${suffix}`;

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
    id("api-url"),
  ) as HTMLInputElement;
  const apiTokenElement = document.getElementById(
    id("api-token"),
  ) as HTMLInputElement;
  const outputDirElement = document.getElementById(
    id("output-dir"),
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
  const apiUrlElement = document.getElementById(id("api-url"));
  apiUrlElement?.addEventListener("input", (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setPref("eagleApiUrl", value);
  });

  // Bind Eagle API Token changes
  const apiTokenElement = document.getElementById(id("api-token"));
  apiTokenElement?.addEventListener("input", (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setPref("eagleApiToken", value);
  });

  // Bind Output Directory changes
  const outputDirElement = document.getElementById(id("output-dir"));
  outputDirElement?.addEventListener("input", (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setPref("outputDirectory", value);
  });

  // Bind Test Connection button (support both XUL "command" and "click")
  const testButton = document.getElementById(btn("test-connection")) as
    | (HTMLElement & { label?: string })
    | null;
  const statusElement = document.getElementById(
    btn("connection-status"),
  ) as HTMLElement | null;

  const setButtonLabel = (btn: any, text: string) => {
    // XUL <button> uses "label" attribute/property; HTML button uses textContent
    try {
      if (btn?.setAttribute) btn.setAttribute("label", text);
      if (typeof btn?.label !== "undefined") btn.label = text;
      if (typeof btn?.textContent !== "undefined") btn.textContent = text;
    } catch (err) {
      // Non-fatal: label update may differ between XUL/HTML buttons
    }
  };

  const handleTestConnection = async (e?: Event) => {
    if (!testButton) return;
    // Prefer the button element we looked up, not e.target
    const button = testButton as any;
    if (button.disabled) return; // guard against duplicate events (click + command)
    const originalLabel =
      (button.getAttribute?.("label") as string) ||
      (button.label as string) ||
      (button.textContent as string) ||
      "Test Connection";

    if (!statusElement) {
      // Still disable briefly to provide click feedback
      button.disabled = true;
      setButtonLabel(button, "Testing...");
    }

    // UI: disable and clear status
    button.disabled = true;
    setButtonLabel(button, "Testing...");
    if (statusElement) {
      statusElement.textContent = "";
      statusElement.style.color = "";
    }

    try {
      const apiUrl =
        (
          document.getElementById(id("api-url")) as HTMLInputElement
        )?.value?.trim() ||
        (getPref("eagleApiUrl") as string) ||
        "http://localhost:41595";

      const apiToken =
        (
          document.getElementById(id("api-token")) as HTMLInputElement
        )?.value?.trim() ||
        (getPref("eagleApiToken") as string) ||
        "";

      const result = await testEagleConnection(apiUrl, apiToken);

      if (statusElement) {
        if (result.success) {
          statusElement.textContent = "✓ Connection successful!";
          statusElement.style.color = "#28a745";
        } else {
          statusElement.textContent = `✗ ${result.error}`;
          statusElement.style.color = "#dc3545";
        }
      }
    } catch (error: any) {
      if (statusElement) {
        statusElement.textContent = `✗ ${error?.message || "Connection failed"}`;
        statusElement.style.color = "#dc3545";
      }
    } finally {
      setButtonLabel(button, originalLabel);
      button.disabled = false;
    }
  };

  if (testButton) {
    // XUL buttons fire "command"; in some contexts only "click" fires — wire both.
    testButton.addEventListener("command", handleTestConnection);
    testButton.addEventListener("click", handleTestConnection);
  }
}
