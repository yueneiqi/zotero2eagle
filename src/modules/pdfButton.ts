import { config } from "../../package.json";

class PDFButton {
  id: string | null;
  version: string | null;
  rootURI: string | null;
  name: string;
  initialized: boolean;
  notifierID: string | null;
  activeReader: any | null;
  annotationObserverID: string | null;

  constructor() {
    this.id = null;
    this.version = null;
    this.rootURI = null;
    this.name = "Zotero2Eagle PDF Button";
    this.initialized = false;
    this.notifierID = null;
    this.activeReader = null;
    this.annotationObserverID = null;
  }

  init({
    id,
    version,
    rootURI,
  }: {
    id: string;
    version: string;
    rootURI: string;
  }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  }

  log(msg: string) {
    Zotero.debug("zotero2eagle: " + msg);
  }

  // Proxy the existing "Select Area" button instead of creating a new one
  proxySelectAreaButton(browserWindow: Window) {
    // Check if we've already proxied the button
    if (
      browserWindow.document.querySelector("#zotero2eagle-proxy-initialized")
    ) {
      this.log("proxySelectAreaButton: window already has proxy");
      return;
    }

    // Find the existing "Select Area" button in Zotero's toolbar
    const selectAreaButton = browserWindow.document.querySelector(
      "button[title='Select Area']",
    ) as HTMLButtonElement;
    if (!selectAreaButton) {
      this.log("proxySelectAreaButton: Select Area button not found");
      return;
    }

    // Mark that we've initialized the proxy
    const marker = browserWindow.document.createElement("div");
    marker.setAttribute("id", "zotero2eagle-proxy-initialized");
    marker.style.display = "none";
    if (browserWindow.document.body) {
      browserWindow.document.body.appendChild(marker);
    }

    // Add our own click handler to the existing button
    selectAreaButton.addEventListener("click", () => {
      this.log("Proxy: Select Area button clicked");
      // Register an observer to detect when annotations are created
      this.registerAnnotationObserver(browserWindow);
    });

    this.log("Successfully proxied Select Area button");
  }

  // Register an observer to watch for new annotations
  registerAnnotationObserver(browserWindow: Window) {
    this.log("Registering annotation observer");

    // Register a Zotero notifier observer for item additions/changes
    const annotationCallback = {
      notify: async (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        if (type === "item") {
          // Check if any of the changed items are annotations
          for (const id of ids) {
            try {
              const item = await Zotero.Items.getAsync(id as number);
              if (item && item.isAnnotation()) {
                const annotationId = item.key;
                this.log(`New annotation detected with ID: ${annotationId}`);

                // Get the parent item ID (the PDF item)
                const parentItem = item.parentItem;
                const parentItemId = parentItem ? parentItem.id : "Unknown";

                // Get page number directly from the annotation
                let pageNumber = "Unknown";
                try {
                  // Annotations store page information in their position property
                  const position = item.annotationPosition;
                  if (position) {
                    // Parse the position JSON to extract page index
                    const positionObj = JSON.parse(position);
                    if (
                      positionObj &&
                      typeof positionObj.pageIndex === "number"
                    ) {
                      pageNumber = (positionObj.pageIndex + 1).toString(); // Convert to 1-based index
                    }
                  }
                } catch (e) {
                  this.log(`Error getting page number from annotation: ${e}`);
                }

                this.showAnnotationDetails(
                  annotationId,
                  parentItemId.toString(),
                  pageNumber,
                );
                // Unregister the observer after finding the annotation
                if (this.annotationObserverID) {
                  Zotero.Notifier.unregisterObserver(this.annotationObserverID);
                  this.annotationObserverID = null;
                }
                break;
              }
            } catch (e) {
              this.log(`Error checking item ${id}: ${e}`);
            }
          }
        }
      },
    };

    // Register the observer
    this.annotationObserverID = Zotero.Notifier.registerObserver(
      annotationCallback,
      ["item"],
    );

    // Set a timeout to unregister the observer if no annotation is found
    setTimeout(() => {
      if (this.annotationObserverID) {
        Zotero.Notifier.unregisterObserver(this.annotationObserverID);
        this.annotationObserverID = null;
        this.log("Annotation observer timeout - unregistered");
      }
    }, 10000); // 10 seconds timeout
  }

  // Show the annotation details (ID, item ID, and page number) in a popup
  showAnnotationDetails(
    annotationId: string,
    itemId: string,
    pageNumber: string,
  ) {
    this.log(
      `Showing annotation details - ID: ${annotationId}, Item ID: ${itemId}, Page: ${pageNumber}`,
    );

    // Create a progress window to display the annotation details
    const progressWindow = new ztoolkit.ProgressWindow(this.name)
      .createLine({
        text: `Annotation: ${annotationId}`,
        type: "success",
        progress: 33,
      })
      .createLine({
        text: `Item ID: ${itemId}`,
        type: "success",
        progress: 66,
      })
      .createLine({
        text: `Page: ${pageNumber}`,
        type: "success",
        progress: 100,
      })
      .show();

    // Close the window automatically after a few seconds
    progressWindow.startCloseTimer(5000);
  }

  addAllButtons() {
    this.log("proxy button for all open tabs");
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      if (!win.ZoteroPane) continue;
      const browsers = win.document.querySelectorAll("browser.reader");
      for (const bro of browsers) {
        const browserWindow = bro.contentWindow;
        this.proxySelectAreaButton(browserWindow);
      }
    }
  }

  removeAllButtons() {
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      if (!win.ZoteroPane) continue;
      const browsers = win.document.querySelectorAll("browser.reader");
      for (const bro of browsers) {
        // Remove our marker element
        const marker = bro.contentWindow.document.querySelector(
          "#zotero2eagle-proxy-initialized",
        );
        if (marker) marker.remove();
      }
    }

    // Unregister any remaining observers
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
    }
    if (this.annotationObserverID) {
      Zotero.Notifier.unregisterObserver(this.annotationObserverID);
    }
  }

  async main() {
    // Add proxy to existing tabs
    setTimeout(() => {
      this.addAllButtons();
    }, 1000);

    // Register tab listener to add proxy to new tabs
    const notifierCallback = {
      notify: async (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        if (
          (event == "load" || event == "add") &&
          type == "tab" &&
          extraData[ids[0]].type == "reader"
        ) {
          this.log(`Tab with id ${ids[0]} ${event}`);
          const reader = Zotero.Reader.getByTabID(ids[0] as string);
          await reader._initPromise;
          const browserWindow = reader._iframeWindow;
          if (browserWindow) {
            this.proxySelectAreaButton(browserWindow);
          }
        }
      },
    };

    this.notifierID = Zotero.Notifier.registerObserver(notifierCallback, [
      "tab",
    ]);
  }
}

export default PDFButton;
