import { initLocale } from "./utils/locale";
import { getPref } from "./utils/prefs";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { FileLogger } from "./utils/fileLogger";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  addon.data.enableEagle = (getPref("enableEagleIntegration") as boolean) || false;

  // Initialize file logger
  await FileLogger.initializeLogger();
  await FileLogger.info("Startup", "Zotero2Eagle plugin starting up");

  // Initialize PDF button functionality
  addon.data.pdfButton.init({
    id: addon.data.config.addonID,
    version: "0.0.1", // addon.data.config.version may not exist
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

/**
 * Dispatcher for Notify events.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // Currently no notify handlers
  ztoolkit.log("notify", event, type, ids, extraData);
}

/**
 * Dispatcher for Preference UI events.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(type: string) {
  // Placeholder for future shortcut handlers
}

function onDialogEvents(type: string) {
  // Placeholder for future dialog handlers
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};

