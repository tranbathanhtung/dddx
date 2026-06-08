import { useCallback, useEffect, useRef, useState } from "react";
import type { Remote } from "comlink";
import { IconDeviceDesktop, IconMessagePlus, IconX } from "@tabler/icons-react";
import type { Node } from "@xyflow/react";

import { usePromptContext } from "@/components/prompt-context-provider";
import { useBridge } from "@/components/dockview/panels/preview/bridge";
import type { ChildApi } from "@/components/dockview/panels/preview/types";
import { Button } from "@/components/ui/button";
import type { CanvasMediaKind } from "@/lib/design-canvas-files";
import { designFilePath } from "@/lib/context";
import { cn } from "@/lib/utils";

import type { NodeData } from "./nodes/types";

function withDevtoolsParam(src: string): string {
  const url = new URL(src, window.location.origin);
  url.searchParams.set("dddx_devtools", "1");
  return url.pathname + url.search + url.hash;
}

export function Fullscreen({
  node,
  onClose,
  onAnnotatingChange,
}: {
  node: Node;
  onClose: () => void;
  onAnnotatingChange?: (active: boolean) => void;
}) {
  const rawSrc = node.data?.src ? String(node.data.src) : undefined;
  const kind =
    (node.data as { mediaKind?: CanvasMediaKind })?.mediaKind ?? "html";
  const srcDoc = rawSrc ? undefined : String(node.data?.source ?? "");
  const label = String(node.data?.label ?? "Preview");
  const nodeData = node.data as NodeData | undefined;
  const isHtml = kind === "html";
  const src = rawSrc && isHtml ? withDevtoolsParam(rawSrc) : rawSrc;

  const getAnnotationContext = useCallback(() => {
    const workspaceId = nodeData?.workspaceId;
    const filePath = nodeData?.filePath;
    return {
      source: "design-canvas" as const,
      url: src ?? rawSrc,
      frame: label,
      file: filePath,
      workspace: workspaceId,
      path:
        workspaceId && filePath
          ? designFilePath(workspaceId, filePath)
          : undefined,
    };
  }, [label, nodeData?.filePath, nodeData?.workspaceId, rawSrc, src]);

  const { insertContextInput } = usePromptContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const childRef = useRef<Remote<ChildApi> | null>(null);
  const [annotate, setAnnotate] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const annotateRef = useRef(annotate);
  annotateRef.current = annotate;

  const handleAnnotateChange = useCallback((active: boolean) => {
    setAnnotate(active);
    onAnnotatingChange?.(active);
  }, []);

  const { ready, reset } = useBridge({
    iframeRef,
    childRef,
    insertContext: insertContextInput,
    getAnnotationContext,
    onUrl: () => {},
    onAnnotate: handleAnnotateChange,
  });

  useEffect(() => {
    reset();
    setAnnotate(false);
    onAnnotatingChange?.(false);
  }, [src, srcDoc]);

  useEffect(() => {
    return () => {
      reset();
      onAnnotatingChange?.(false);
    };
  }, []);

  const onEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (annotateRef.current) {
        void childRef.current?.setAnnotationActive(false);
      } else {
        onClose();
      }
    },
    [onClose],
  );

  // Parent window (toolbar / canvas chrome focused).
  useEffect(() => {
    if (!isHtml) return;
    window.addEventListener("keydown", onEscapeKey);
    return () => window.removeEventListener("keydown", onEscapeKey);
  }, [isHtml]);

  // Iframe document (preview content focused) — key events do not bubble to parent.
  useEffect(() => {
    if (!isHtml) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const attach = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.addEventListener("keydown", onEscapeKey);
      return () => win.removeEventListener("keydown", onEscapeKey);
    };

    let detach = attach();
    const onLoad = () => {
      detach?.();
      detach = attach();
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      detach?.();
    };
  }, [isHtml, src, srcDoc]);

  if (!rawSrc && !srcDoc) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center justify-end gap-1 border-b border-border px-2">
        {isHtml ? (
          <Button
            aria-label={annotate ? "Stop annotating (Esc)" : "Start annotating"}
            aria-pressed={annotate}
            size="sm"
            variant="ghost"
            disabled={!ready}
            className={cn(
              "h-7 min-w-7 overflow-hidden px-0 transition-[width,gap,padding,background-color,color,box-shadow] duration-300 ease-out",
              annotate
                ? "gap-1.5 px-2.5 bg-sky-100 text-sky-700 shadow-none hover:bg-sky-100 hover:text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-950/60 dark:hover:text-sky-300"
                : "w-7 hover:bg-muted",
            )}
            onClick={() => void childRef.current?.toggleAnnotation()}
          >
            <IconMessagePlus
              className={cn(
                "size-4 shrink-0 transition-transform duration-300 ease-out",
                annotate && "scale-110",
              )}
            />
            <span
              aria-hidden={!annotate}
              className={cn(
                "overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-300 ease-out",
                annotate
                  ? "max-w-24 translate-x-0 opacity-100"
                  : "max-w-0 -translate-x-1 opacity-0",
              )}
            >
              Annotating
            </span>
          </Button>
        ) : null}
        {isHtml ? (
          <Button
            aria-label="Toggle device width"
            size="icon-sm"
            variant="ghost"
            onClick={() =>
              setDevice((d) => (d === "desktop" ? "mobile" : "desktop"))
            }
          >
            <IconDeviceDesktop />
          </Button>
        ) : null}
        <Button
          aria-label="Close fullscreen"
          size="icon-sm"
          variant="ghost"
          onClick={onClose}
        >
          <IconX />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {kind === "image" ? (
          <img
            src={rawSrc}
            alt={label}
            className="h-full w-full object-contain"
          />
        ) : kind === "video" ? (
          <video
            src={rawSrc}
            className="h-full w-full object-contain"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <div className="h-full bg-muted">
            <div
              className="mx-auto h-full min-h-0 transition-all duration-200 ease-in-out"
              style={{ width: device === "desktop" ? "100%" : 428 }}
            >
              <iframe
                ref={iframeRef}
                src={src}
                srcDoc={srcDoc}
                title={label}
                className="h-full w-full border-0"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation allow-downloads"
                allow="camera *; microphone *; geolocation *; fullscreen *; autoplay *; payment *; usb *; midi *; encrypted-media *"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
