import type { NodeProps } from "@xyflow/react";

import type { NodeData } from "./types";

export function frameNodeEqual(prev: NodeProps, next: NodeProps): boolean {
  if (prev.id !== next.id) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.dragging !== next.dragging) return false;
  if (prev.zIndex !== next.zIndex) return false;

  const a = prev.data as NodeData | undefined;
  const b = next.data as NodeData | undefined;
  if (!a || !b) return a === b;

  return (
    a.width === b.width &&
    a.height === b.height &&
    a.label === b.label &&
    a.src === b.src &&
    a.source === b.source &&
    a.mediaKind === b.mediaKind &&
    a.framePreset === b.framePreset &&
    a.__interactive === b.__interactive &&
    a.fileActivity === b.fileActivity &&
    a.workspaceId === b.workspaceId &&
    a.filePath === b.filePath &&
    a.imageGenerating === b.imageGenerating &&
    a.generateImage === b.generateImage &&
    a.imageEdit === b.imageEdit
  );
}
