import type { CanvasMediaKind, FramePreset } from "@/lib/design-canvas-files";
import type { ImageGenerateConfig } from "@/lib/image-generation";

export type NodeData = {
  width: number;
  height: number;
  label: string;
  src?: string;
  source?: string;
  mediaKind?: CanvasMediaKind;
  framePreset?: FramePreset;
  __interactive?: boolean;
  fileActivity?: "creating" | "updating";
  workspaceId?: string;
  filePath?: string;
  generateImage?: ImageGenerateConfig;
  /** When set, the image frame shows the AI edit panel. */
  imageEdit?: ImageGenerateConfig;
  imageGenerating?: boolean;
};

export type FrameContentProps = {
  id: string;
  data: NodeData;
  live: boolean;
  busy: boolean;
};
