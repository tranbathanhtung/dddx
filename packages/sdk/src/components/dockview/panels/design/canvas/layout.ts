import type { Node } from "@xyflow/react";
import type { FitViewOptions } from "@xyflow/react";

export const FIT_PAD = {
  top: "80px",
  right: "96px",
  bottom: "160px",
  left: "96px",
} as const;

export const FIT_OPTS: FitViewOptions = {
  padding: FIT_PAD,
  duration: 300,
};

const GAP_X = 40;
const GAP_Y = 100;
const DEF_W = 400;
const DEF_H = 600;

function nodeWidth(node: Node) {
  return (node.data as { width?: number })?.width || DEF_W;
}

function groupKey(node: Node) {
  return (
    ((node.data as { workspaceId?: string })?.workspaceId ?? node.type) ||
    "default"
  );
}

/** Place a new node to the right of the rightmost node in the same group. */
export function placeNodeBesideLast(nodes: Node[], node: Node): { x: number; y: number } {
  const key = groupKey(node);
  const group = nodes.filter((n) => groupKey(n) === key);
  if (group.length === 0) return { x: 0, y: 0 };

  let rightmost = group[0]!;
  let maxRight = rightmost.position.x + nodeWidth(rightmost);

  for (const n of group) {
    const right = n.position.x + nodeWidth(n);
    if (right > maxRight) {
      maxRight = right;
      rightmost = n;
    }
  }

  return {
    x: rightmost.position.x + nodeWidth(rightmost) + GAP_X,
    y: rightmost.position.y,
  };
}

/** Full auto-layout — use only when initializing the canvas. */
export function layoutNodes(nodes: Node[]): Node[] {
  const groups = new Map<string, Node[]>();
  nodes.forEach((node) => {
    const key =
      ((node.data as { workspaceId?: string })?.workspaceId ?? node.type) ||
      "default";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  });

  const laidOut: Node[] = [];
  let y = 0;

  for (const group of groups.values()) {
    let x = 0;
    let maxH = 0;

    for (const node of group) {
      const w = (node.data as { width?: number })?.width || DEF_W;
      const h = (node.data as { height?: number })?.height || DEF_H;

      laidOut.push({ ...node, position: { x, y } });
      x += w + GAP_X;
      if (h > maxH) maxH = h;
    }

    y += maxH + GAP_Y;
  }

  return laidOut;
}
