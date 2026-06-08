import { memo, useCallback } from "react";
import { IconCode } from "@tabler/icons-react";

import { CustomEventEnum, dispatch } from "@/lib/custom-event";
import { GenerateMenu } from "../generate-menu";
import type { FrameContentProps } from "./types";

type HtmlNodeProps = FrameContentProps;

export const HtmlNode = memo(function HtmlNode({
  id,
  data,
  live,
  busy,
}: HtmlNodeProps) {
  const { label, src, source } = data;

  if (busy) {
    return <div className="size-full bg-muted" aria-hidden />;
  }

  return (
    <iframe
      key={src}
      src={src}
      srcDoc={src ? undefined : source}
      title={label}
      name={`dddx-studio-${id}`}
      className="size-full border-0"
      style={{ pointerEvents: live ? "auto" : "none" }}
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation allow-downloads"
      allow="camera *; microphone *; geolocation *; fullscreen *; autoplay *; payment *; usb *; midi *; encrypted-media *"
    />
  );
});

export const HtmlNodeToolbar = memo(function HtmlNodeToolbar({
  nodeId,
  label,
}: {
  nodeId: string;
  label: string;
}) {
  const onImplement = useCallback(() => {
    dispatch(CustomEventEnum.DesignCanvasRequestSend, {
      detail: {
        nodeId,
        mode: "agent",
        text: `Implement the attached design frame "${label}" into the main codebase. Read its HTML, CSS, and JS, follow existing project patterns and conventions, and wire it into the real application.`,
      },
    });
  }, [nodeId, label]);

  return (
    <>
      <span className="mx-1 h-4 w-px bg-border" />
      <GenerateMenu nodeId={nodeId} label={label} />
      <button
        type="button"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={onImplement}
      >
        <IconCode className="size-4" />
        <span className="text-sm font-medium">Implement</span>
      </button>
    </>
  );
});
