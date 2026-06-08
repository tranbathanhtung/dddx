export const CANVAS_NODE_TYPES = [
  "html",
  "image",
  "video",
  "generate",
] as const;

export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[number];

export function isCanvasNodeType(type: string | undefined): type is CanvasNodeType {
  return CANVAS_NODE_TYPES.includes(type as CanvasNodeType);
}

export function isGenerateNode(node: {
  type?: string;
  data?: unknown;
}): boolean {
  return (
    node.type === "generate" ||
    !!(node.data as { generateImage?: unknown } | undefined)?.generateImage
  );
}
