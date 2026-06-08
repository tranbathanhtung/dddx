declare global {
  interface Window {
    /**
     * dddx runtime surface (studio loader, devtools host, preview extensions).
     *
     * @example
     * dddx.action.onClicked(function () { ... });
     * dddx.extension.onDispose(function () { ... });
     */
    dddx?: {
      loaded?: boolean;
      styles?: string;
      url?: string;
      /** Active preview extension id (devtools host). */
      extId?: string;
      action?: {
        onClicked: (listener: () => void) => void;
      };
      extension?: {
        onDispose: (dispose: () => void) => void;
      };
    };
  }
}

export {};
