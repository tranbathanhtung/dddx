import { useEffect } from "react";

import { useLatest } from "@/hooks/use-latest";
import { CustomEventEnum, listen } from "@/lib/custom-event";

export type CanvasHandlers = {
  onAgentWs: (id: string | null) => void;
  onVariants: (nodeId: string) => void;
  onImage: (detail: { nodeId?: string; replace?: boolean }) => void;
  onSend: (detail: {
    nodeId?: string;
    text?: string;
    mode?: "agent" | "design";
  }) => void;
};

/** Wire the design-canvas custom events to stable handlers. */
export function useEvents(handlers: CanvasHandlers) {
  const ref = useLatest(handlers);

  useEffect(() => {
    const offs = [
      listen<{ id?: string | null }>(
        CustomEventEnum.DesignWorkspaceActive,
        (event) => ref.current.onAgentWs(event.detail?.id ?? null),
      ),
      listen<{ nodeId?: string }>(
        CustomEventEnum.DesignCanvasOpenVariants,
        (event) => {
          const id = event.detail?.nodeId;
          if (id) ref.current.onVariants(id);
        },
      ),
      listen<{ nodeId?: string; replace?: boolean }>(
        CustomEventEnum.DesignCanvasImageGenerated,
        (event) => ref.current.onImage(event.detail ?? {}),
      ),
      listen<{ nodeId?: string; text?: string; mode?: "agent" | "design" }>(
        CustomEventEnum.DesignCanvasRequestSend,
        (event) => ref.current.onSend(event.detail ?? {}),
      ),
    ];
    return () => offs.forEach((off) => off());
  }, [ref]);
}
