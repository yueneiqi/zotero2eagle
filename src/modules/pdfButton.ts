import { config } from "../../package.json";
import {
  ImageSaver,
  ImageAnnotationData,
  ImageSaveResult,
} from "../utils/imageSaver";
import { FileLogger } from "../utils/fileLogger";

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

  async log(msg: string, level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO") {
    await FileLogger.log(level, "PDFButton", msg);
  }

  // Proxy the existing "Select Area" button instead of creating a new one
  async proxySelectAreaButton(browserWindow: Window) {
    // Check if we've already proxied the button
    if (
      browserWindow.document.querySelector("#zotero2eagle-proxy-initialized")
    ) {
      this.log("proxySelectAreaButton: window already has proxy");
      return;
    }

    // Try to find the button with retry and multiple strategies
    const selectAreaButton = await this.findSelectAreaButton(browserWindow);
    if (!selectAreaButton) {
      this.log(
        "proxySelectAreaButton: Select Area button not found after all attempts",
      );
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

  // Find the Select Area button with multiple strategies and retry mechanism
  private async findSelectAreaButton(
    browserWindow: Window,
  ): Promise<HTMLButtonElement | null> {
    const selectors = [
      // Common selectors for the Select Area button
      "button[title='Select Area']",
      "button[data-l10n-id*='select-area']",
      "button[aria-label*='Select Area']",
      "button[aria-label*='select area']",
      ".toolbar button[title*='Select']",
      ".toolbar button[title*='Area']",
      // Additional selectors for different Zotero versions
      ".splitButton button[title='Select Area']",
      ".toolbar-button[title='Select Area']",
      "button[id*='select-area']",
      "button[class*='select-area']",
      // Generic fallback selectors
      "button:has([data-l10n-id*='select-area'])",
      "button:has([aria-label*='Select Area'])",
    ];

    const maxRetries = 10;
    const retryDelay = 500; // 500ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log(`Attempt ${attempt} to find Select Area button`);

      // Try each selector strategy
      for (const selector of selectors) {
        try {
          const button = browserWindow.document.querySelector(
            selector,
          ) as HTMLButtonElement;
          if (button && this.isValidSelectAreaButton(button)) {
            this.log(`Found Select Area button using selector: ${selector}`);
            return button;
          }
        } catch (error) {
          // Some selectors might fail in certain browsers, continue to next
          continue;
        }
      }

      // Try finding by text content as fallback
      const buttonByText = this.findButtonByText(browserWindow);
      if (buttonByText) {
        this.log("Found Select Area button by text content");
        return buttonByText;
      }

      // Wait before next attempt (except for the last attempt)
      if (attempt < maxRetries) {
        this.log(
          `Select Area button not found, waiting ${retryDelay}ms before retry ${attempt + 1}`,
        );
        await this.sleep(retryDelay);
      }
    }

    this.log("Select Area button not found after all attempts and strategies");
    return null;
  }

  // Validate that the found button is actually the Select Area button
  private isValidSelectAreaButton(button: HTMLButtonElement): boolean {
    if (!button) return false;

    const title = button.title?.toLowerCase() || "";
    const ariaLabel = button.getAttribute("aria-label")?.toLowerCase() || "";
    const className = button.className?.toLowerCase() || "";
    const id = button.id?.toLowerCase() || "";

    // Check if it matches expected patterns
    const selectAreaPatterns = ["select area", "select-area", "selectarea"];

    return selectAreaPatterns.some(
      (pattern) =>
        title.includes(pattern) ||
        ariaLabel.includes(pattern) ||
        className.includes(pattern) ||
        id.includes(pattern),
    );
  }

  // Find button by text content as fallback
  private findButtonByText(browserWindow: Window): HTMLButtonElement | null {
    const buttons = browserWindow.document.querySelectorAll("button");

    for (const button of buttons) {
      const textContent = button.textContent?.toLowerCase() || "";
      const innerHTML = button.innerHTML?.toLowerCase() || "";

      if (
        textContent.includes("select area") ||
        innerHTML.includes("select area") ||
        (textContent.includes("select") && textContent.includes("area"))
      ) {
        return button as HTMLButtonElement;
      }
    }

    return null;
  }

  // Helper method to sleep/wait
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
                const annotationType = item.annotationType;
                await this.log(
                  `New annotation detected with ID: ${annotationId}, Type: ${annotationType}`,
                );

                // Get the parent item ID (the PDF item)
                const parentItem = item.parentItem;
                const parentItemId = parentItem ? parentItem.id : "Unknown";
                const parentItemKey = parentItem ? parentItem.key : "Unknown"; // This is the short key like "F5BWVR4N"

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

                await this.showAnnotationDetails(
                  item,
                  annotationId,
                  annotationType,
                  parentItemId.toString(),
                  parentItemKey,
                  pageNumber,
                );

                // Note: Image capture will be handled by the ImageSaver utility
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

  // Show the annotation details (ID, type, item ID, item key, and page number) in a popup
  async showAnnotationDetails(
    item: any,
    annotationId: string,
    annotationType: string,
    itemId: string,
    itemKey: string,
    pageNumber: string,
  ) {
    this.log(
      `Showing annotation details - ID: ${annotationId}, Type: ${annotationType}, Item ID: ${itemId}, Item Key: ${itemKey}, Page: ${pageNumber}`,
    );

    // If this is an image annotation, try to save the image
    let imageSaveStatus = "";
    let imageSaveSuccess = false;
    if (annotationType === "image") {
      try {
        const metadata = await ImageSaver.getParentItemMetadata(item);
        const annotationData: ImageAnnotationData = {
          annotationId,
          annotationType,
          itemId,
          itemKey,
          pageNumber,
          ...metadata,
        };

        const saveResult: ImageSaveResult =
          await ImageSaver.saveAnnotationImage(item, annotationData);

        imageSaveStatus = saveResult.message;
        imageSaveSuccess = saveResult.success;

        if (saveResult.success) {
          await this.log(`Image annotation saved: ${saveResult.message}`);
        } else {
          await this.log(
            `Failed to save image annotation: ${saveResult.message}`,
            "WARN",
          );
        }
      } catch (error) {
        imageSaveStatus = "Image save error occurred";
        imageSaveSuccess = false;
        await this.log(`Error saving image annotation: ${error}`, "ERROR");
      }
    }

    // Create a progress window to display the annotation details
    const progressWindow = new ztoolkit.ProgressWindow(this.name)
      .createLine({
        text: `Annotation: ${annotationId}`,
        type: "success",
        progress: 20,
      })
      .createLine({
        text: `Type: ${annotationType}`,
        type: "success",
        progress: 40,
      })
      .createLine({
        text: `Item ID: ${itemId}`,
        type: "success",
        progress: 60,
      })
      .createLine({
        text: `Item Key: ${itemKey}`,
        type: "success",
        progress: 80,
      })
      .createLine({
        text: `Page: ${pageNumber}`,
        type: "success",
        progress: 80,
      });

    // Add image save status line if applicable
    if (imageSaveStatus) {
      const statusType = imageSaveSuccess ? "success" : "fail";
      progressWindow.createLine({
        text: imageSaveStatus,
        type: statusType,
        progress: 100,
      });
    } else {
      progressWindow.createLine({
        text: "Processing completed",
        type: "success",
        progress: 100,
      });
    }

    progressWindow.show();

    // Close the window automatically after a few seconds
    progressWindow.startCloseTimer(5000);
  }

  async addAllButtons() {
    this.log("proxy button for all open tabs");
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      if (!win.ZoteroPane) continue;
      const browsers = win.document.querySelectorAll("browser.reader");
      for (const bro of browsers) {
        const browserWindow = bro.contentWindow;
        // Run async but don't wait for completion to avoid blocking
        this.proxySelectAreaButton(browserWindow).catch((error) =>
          this.log(`Error proxying button: ${error}`, "ERROR"),
        );
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
    setTimeout(async () => {
      await this.addAllButtons();
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
            // Run async but don't wait for completion to avoid blocking
            this.proxySelectAreaButton(browserWindow).catch((error) =>
              this.log(`Error proxying button: ${error}`, "ERROR"),
            );
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
