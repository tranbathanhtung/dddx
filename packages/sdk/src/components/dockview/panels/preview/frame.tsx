import { forwardRef, useLayoutEffect, useRef } from "react";
import type { Status } from "./types";
import { sameUrl } from "./url";

export const Frame = forwardRef<
  HTMLIFrameElement,
  {
    url: string;
    device: "desktop" | "mobile";
    status: Status;
    onLoad: () => void;
    onError: () => void;
  }
>(function Frame({ url, device, status, onLoad, onError }, ref) {
  const appliedUrl = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref && typeof ref !== "function" ? ref.current : null;
    if (!url || !el) return;
    if (appliedUrl.current === url) return;

    try {
      const current = el.contentWindow?.location.href;
      if (current && sameUrl(current, url)) {
        appliedUrl.current = url;
        return;
      }
    } catch {
      // cross-origin — fall through to src assignment
    }

    appliedUrl.current = url;
    el.src = url;
  }, [url, ref]);

  return (
    <div className="bg-muted flex-1">
      <div
        className="mx-auto min-h-0 transition-all duration-200 ease-in-out"
        style={{ width: device === "desktop" ? "100%" : 428 }}
      >
        <div className="relative h-full w-full">
          {status === "loading" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-foreground/5">
              <div className="preview-loading-bar h-full w-1/3 rounded-full bg-foreground/45" />
            </div>
          )}
          {url ? (
            <iframe
              ref={ref}
              className="h-full min-h-full w-full grow"
              name="nothinq"
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups-to-escape-sandbox allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-presentation"
              allow="fullscreen; camera; microphone; gyroscope; accelerometer; geolocation; clipboard-write;"
              onLoad={onLoad}
              onError={onError}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});
