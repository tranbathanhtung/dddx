import type { Node } from "@xyflow/react";

import type { CanvasMediaKind } from "@/lib/design-canvas-files";
import { studioProjectSlug } from "@/lib/project-path";
import type { ImageGenerateConfig } from "@/lib/image-generation";

import type { CanvasNodeType } from "./node-types";

const DEF = { width: 1440, height: 1024, label: "Desktop" } as const;
const GENERATE_FRAME = { width: 420, height: 280, label: "Generate image" };

export type NodeInput = {
  id?: string;
  src?: string;
  source?: string;
  width?: number;
  height?: number;
  label?: string;
  mediaKind?: CanvasMediaKind;
  generateImage?: ImageGenerateConfig;
};

export function previewUrl(
  workspaceId: string,
  filePath: string,
  rev: number,
): string {
  const base = window.dddx?.url ?? "";
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const slug = studioProjectSlug();
  const prefix = slug ? `/p/${encodeURIComponent(slug)}` : "";
  return `${base}${prefix}/designs/${encodeURIComponent(workspaceId)}/${encodedPath}?v=${rev}`;
}

export function makeNode(input: NodeInput = {}): Node {
  const mediaKind = input.mediaKind ?? "html";
  return {
    id: input.id ?? `${mediaKind}-${Date.now()}`,
    type: mediaKind satisfies CanvasNodeType,
    position: { x: 0, y: 0 },
    data: {
      width: input.width ?? DEF.width,
      height: input.height ?? DEF.height,
      label: input.label ?? DEF.label,
      src: input.src,
      source: input.source,
      mediaKind,
      ...(input.generateImage
        ? { generateImage: input.generateImage }
        : {}),
    },
  };
}

export function makeGenerateImageNode(
  input: {
    id?: string;
    position?: { x: number; y: number };
    workspaceId?: string;
    config?: ImageGenerateConfig;
  } = {},
): Node {
  const node: Node = {
    id: input.id ?? `generate-${Date.now()}`,
    type: "generate",
    position: input.position ?? { x: 0, y: 0 },
    data: {
      width: GENERATE_FRAME.width,
      height: GENERATE_FRAME.height,
      label: GENERATE_FRAME.label,
      mediaKind: "image",
      generateImage: input.config,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
  };
  return node;
}
