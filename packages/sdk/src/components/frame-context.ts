import type { Node } from "@xyflow/react";
import type { AttachedCustomContext } from "@/components/agent-elements/input-bar";
import type { CanvasMediaKind } from "@/lib/design-canvas-files";
import { compactContextValue } from "@/lib/context";
import { previewUrl } from "@/components/dockview/panels/design/canvas/nodes/factory";

export type ViewportNodeContextData = {
  label?: string;
  src?: string;
  width?: number;
  height?: number;
  workspaceId?: string;
  filePath?: string;
  mediaKind?: CanvasMediaKind;
};

export function frameContextId(nodeId: string): string {
  return `frame:${nodeId}`;
}

export function isFrameContextId(id: string): boolean {
  return id.startsWith("frame:");
}

export function frameContextFromNode(node: Node): AttachedCustomContext {
  const data = (node.data ?? {}) as ViewportNodeContextData;
  const label = data.label ?? "Screen";
  const filePath = data.filePath ?? label;
  const mediaKind = data.mediaKind ?? "html";
  const ws = data.workspaceId?.trim();

  const path = ws ? `${ws}/${filePath}` : filePath;
  const preview =
    mediaKind === "video" || !data.src || !ws
      ? undefined
      : previewUrl(ws, filePath, Date.now());

  return {
    id: frameContextId(node.id),
    name: label,
    kind: "frame",
    value: compactContextValue({ path, preview }),
  };
}
