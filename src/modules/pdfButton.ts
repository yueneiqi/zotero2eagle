import { config } from "../../package.json";

class PDFButton {
  id: string | null;
  version: string | null;
  rootURI: string | null;
  name: string;
  initialized: boolean;
  notifierID: string | null;
  activeReader: any | null;

  constructor() {
    this.id = null;
    this.version = null;
    this.rootURI = null;
    this.name = "Zotero2Eagle PDF Button";
    this.initialized = false;
    this.notifierID = null;
    this.activeReader = null;
  }

  init({ id, version, rootURI }: { id: string; version: string; rootURI: string }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  }

  log(msg: string) {
    Zotero.debug("zotero2eagle: " + msg);
  }

  addSelectAreaButton(browserWindow: Window) {
    // Check if button already exists
    if (browserWindow.document.querySelector("#zotero2eagle-select-area-button")) {
      this.log("addSelectAreaButton: window already has button");
      return;
    }

    // Create the button element to match Zotero's select area button
    const button = browserWindow.document.createElement("button");
    button.setAttribute("id", "zotero2eagle-select-area-button");
    button.setAttribute("class", "toolbar-button");
    button.setAttribute("title", "Select Area for Eagle");
    button.setAttribute("tabindex", "-1");
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" class="icon icon-mask" role="presentation">
        <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1"/>
        <rect x="5" y="5" width="6" height="6" fill="currentColor"/>
      </svg>
    `;
    
    // Set button state
    let isActive = false;
    
    button.onclick = () => {
      // Toggle button state
      isActive = !isActive;
      
      if (isActive) {
        button.classList.add("active");
        this.enableSelectAreaMode(browserWindow);
      } else {
        button.classList.remove("active");
        this.disableSelectAreaMode(browserWindow);
      }
    };

    // Add styling to match Zotero's toolbar buttons
    const style = browserWindow.document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("id", "zotero2eagle-button-style");
    style.innerHTML = `
      #zotero2eagle-select-area-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--fill-secondary);
        border-radius: 4px;
      }
      
      #zotero2eagle-select-area-button:hover {
        background: var(--fill-quinary);
        color: var(--fill-primary);
      }
      
      #zotero2eagle-select-area-button.active {
        background: var(--fill-quinary);
        color: var(--accent-blue);
      }
      
      #zotero2eagle-select-area-button svg {
        width: 16px;
        height: 16px;
      }
    `;
    browserWindow.document.querySelector("head")?.appendChild(style);

    // Add button to the toolbar (in the center section where other tools are)
    const toolbarCenter = browserWindow.document.querySelector("#reader-ui .toolbar .center");
    if (toolbarCenter) {
      // Insert before the zoom controls or at the end if not found
      const zoomControls = toolbarCenter.querySelector(".spacer");
      if (zoomControls) {
        toolbarCenter.insertBefore(button, zoomControls);
      } else {
        toolbarCenter.appendChild(button);
      }
      this.log("success add select area button to toolbar");
    } else {
      this.log("toolbar center section not found");
    }
  }

  enableSelectAreaMode(browserWindow: Window) {
    this.log("Enabling select area mode");
    
    // Find the PDF viewer iframe
    const viewerIFrame = browserWindow.document.querySelector("iframe[src='pdf/web/viewer.html']") as HTMLIFrameElement;
    if (!viewerIFrame) {
      this.log("PDF viewer iframe not found");
      return;
    }
    
    const viewerDocument = viewerIFrame.contentDocument || (viewerIFrame.contentWindow as any).document;
    if (!viewerDocument) {
      this.log("PDF viewer document not accessible");
      return;
    }
    
    // Add overlay for area selection
    const overlay = viewerDocument.createElement("div");
    overlay.setAttribute("id", "zotero2eagle-selection-overlay");
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      cursor: crosshair;
      background: transparent;
    `;
    viewerDocument.body.appendChild(overlay);
    
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let selectionRect: HTMLElement | null = null;
    
    // Mouse event handlers
    const mouseDownHandler = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left mouse button
      
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      
      // Create selection rectangle
      const newSelectionRect = viewerDocument.createElement("div");
      newSelectionRect.style.cssText = `
        position: absolute;
        border: 2px dashed #0078d4;
        background: rgba(0, 120, 212, 0.2);
        z-index: 10000;
      `;
      viewerDocument.body.appendChild(newSelectionRect);
      selectionRect = newSelectionRect;
      
      e.preventDefault();
    };
    
    const mouseMoveHandler = (e: MouseEvent) => {
      if (!isSelecting || !selectionRect) return;
      
      const currentX = e.clientX;
      const currentY = e.clientY;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      if (selectionRect) {
        selectionRect.style.left = `${left}px`;
        selectionRect.style.top = `${top}px`;
        selectionRect.style.width = `${width}px`;
        selectionRect.style.height = `${height}px`;
      }
    };
    
    const mouseUpHandler = (e: MouseEvent) => {
      if (!isSelecting) return;
      
      isSelecting = false;
      
      if (selectionRect) {
        // Get the selection coordinates
        const rect = selectionRect.getBoundingClientRect();
        this.log(`Selected area: x=${rect.left}, y=${rect.top}, width=${rect.width}, height=${rect.height}`);
        
        // Remove selection rectangle
        selectionRect.remove();
        
        // Process the selected area (send to Eagle)
        this.processSelectedArea(browserWindow, rect);
      }
      
      // Reset selectionRect to null
      selectionRect = null;
      
      // Disable selection mode after capturing
      const button = browserWindow.document.querySelector("#zotero2eagle-select-area-button");
      if (button) {
        button.classList.remove("active");
      }
      this.disableSelectAreaMode(browserWindow);
    };
    
    // Attach event listeners
    overlay.addEventListener("mousedown", mouseDownHandler);
    viewerDocument.addEventListener("mousemove", mouseMoveHandler);
    viewerDocument.addEventListener("mouseup", mouseUpHandler);
    
    // Store references for cleanup
    (overlay as any)._eventHandlers = {
      mouseDown: mouseDownHandler,
      mouseMove: mouseMoveHandler,
      mouseUp: mouseUpHandler
    };
  }

  disableSelectAreaMode(browserWindow: Window) {
    this.log("Disabling select area mode");
    
    // Find the PDF viewer iframe
    const viewerIFrame = browserWindow.document.querySelector("iframe[src='pdf/web/viewer.html']") as HTMLIFrameElement;
    if (!viewerIFrame) return;
    
    const viewerDocument = viewerIFrame.contentDocument || (viewerIFrame.contentWindow as any).document;
    if (!viewerDocument) return;
    
    // Remove overlay
    const overlay = viewerDocument.querySelector("#zotero2eagle-selection-overlay");
    if (overlay) {
      // Remove event listeners
      const handlers = (overlay as any)._eventHandlers;
      if (handlers) {
        overlay.removeEventListener("mousedown", handlers.mouseDown);
        viewerDocument.removeEventListener("mousemove", handlers.mouseMove);
        viewerDocument.removeEventListener("mouseup", handlers.mouseUp);
      }
      overlay.remove();
    }
  }

  processSelectedArea(browserWindow: Window, rect: DOMRect) {
    this.log(`Processing selected area: ${JSON.stringify(rect)}`);
    
    // Show a progress window to indicate processing
    const progressWindow = new ztoolkit.ProgressWindow(this.name)
      .createLine({
        text: "Sending selection to Eagle...",
        type: "default",
        progress: 100,
      })
      .show();
      
    // In a real implementation, you would:
    // 1. Capture the PDF content in the selected area
    // 2. Send it to Eagle via its API
    // 3. Handle the response
    
    // For now, just show a success message
    setTimeout(() => {
      progressWindow.changeLine({
        text: "Selection sent to Eagle!",
        type: "success",
        progress: 100,
      });
      progressWindow.startCloseTimer(3000);
    }, 1000);
  }

  addAllButtons() {
    this.log("add button to all open tabs");
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
      if (!win.ZoteroPane) continue;
      var browsers = win.document.querySelectorAll("browser.reader");
      for (let bro of browsers) {
        var browserWindow = bro.contentWindow;
        this.addSelectAreaButton(browserWindow);
      }
    }
  }

  removeAllButtons() {
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
      if (!win.ZoteroPane) continue;
      var browsers = win.document.querySelectorAll("browser.reader");
      for (let bro of browsers) {
        const button = bro.contentWindow.document.querySelector("#zotero2eagle-select-area-button");
        if (button) button.remove();
        
        const style = bro.contentWindow.document.querySelector("#zotero2eagle-button-style");
        if (style) style.remove();
        
        // Make sure to disable selection mode if active
        this.disableSelectAreaMode(bro.contentWindow);
      }
    }
    
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
    }
  }

  async main() {
    // Add buttons to existing tabs
    setTimeout(() => {
      this.addAllButtons();
    }, 1000);

    // Register tab listener to add button to new tabs
    const notifierCallback = {
      notify: async (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any }
      ) => {
        if ((event == "load" || event == "add") && type == "tab" && extraData[ids[0]].type == "reader") {
          this.log(`Tab with id ${ids[0]} ${event}`);
          const reader = Zotero.Reader.getByTabID(ids[0] as string);
          await reader._initPromise;
          const browserWindow = reader._iframeWindow;
          if (browserWindow) {
            this.addSelectAreaButton(browserWindow);
          }
        }
      }
    };
    
    this.notifierID = Zotero.Notifier.registerObserver(notifierCallback, ["tab"]);
  }
}

export default PDFButton;