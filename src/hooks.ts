import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { FileLogger } from "./utils/fileLogger";
/**
 * Minimal, non-example startup hooks for Zotero2Eagle
 */

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Initialize file logger
  await FileLogger.initializeLogger();
  await FileLogger.info("Startup", "Zotero2Eagle plugin starting up");

  // Register the Preferences pane for Zotero2Eagle
  registerPreferencePane();

  // Initialize PDF button functionality
  addon.data.pdfButton.init({
    id: addon.data.config.addonID,
    version: "0.0.1", //addon.data.config.version, - this property doesn't exist in config
    rootURI: rootURI,
  });
  addon.data.pdfButton.main();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  // Optionally insert FTL used by main window UI (kept minimal here)
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );
  // No example UI or prompts; keep window load lean
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

async function onShutdown(): Promise<void> {
  await FileLogger.info("Shutdown", "Zotero2Eagle plugin shutting down");
  await addon.data.taskPool.drain();
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove PDF button
  addon.data.pdfButton.removeAllButtons();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // Keep minimal logging for diagnostics; no example callbacks
  ztoolkit.log("notify", event, type, ids, extraData);
  return;
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

// Register the Preferences pane in Zotero
function registerPreferencePane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};
