import type { Node } from "@xyflow/react";

import {
  canvasNodeLabel,
  defaultCanvasNodeSize,
  framePresetFromPath,
  resolveNaturalMediaNodeSize,
  type CanvasMediaKind,
} from "@/lib/design-canvas-files";

import type { CanvasDocument, CanvasStorage } from "./canvas-storage";
import { layoutNodes, placeNodeBesideLast } from "./layout";
import { makeNode, previewUrl, isGenerateNode } from "./nodes";

export type DesignFile = {
  path: string;
  kind?: "html" | "image" | "video";
  rev: number;
};

export type DesignData = {
  id: string;
  rev?: number;
  files: DesignFile[];
};

export type FileBusy = Map<string, "creating" | "updating">;

export type SyncCanvasResult = {
  nodes: Node[];
  newNodeIds: string[];
  fitAll: boolean;
};

function filePath(node: Node): string | undefined {
  const path = (node.data as { filePath?: string })?.filePath;
  return path ? String(path) : undefined;
}

function makeFileNode(wsId: string, file: DesignFile, wsRev: number): Node {
  const kind = (file.kind ?? "html") as CanvasMediaKind;
  const size = defaultCanvasNodeSize(kind, file.path);
  const node = makeNode({
    id: `design-${wsId}-${file.path}`,
    src: previewUrl(wsId, file.path, Math.max(file.rev, wsRev)),
    label: canvasNodeLabel(file.path),
    width: size.width,
    height: size.height,
    mediaKind: kind,
  });
  node.data = {
    ...node.data,
    workspaceId: wsId,
    filePath: file.path,
    mediaKind: kind,
    framePreset: kind === "html" ? framePresetFromPath(file.path) : undefined,
  };
  return node;
}

/** Replace placeholder media sizes with the asset's intrinsic dimensions. */
async function withMediaSizes(nodes: Node[]): Promise<Node[]> {
  return Promise.all(
    nodes.map(async (node) => {
      const kind = (node.data as { mediaKind?: CanvasMediaKind }).mediaKind;
      const src = node.data?.src ? String(node.data.src) : "";
      if (!kind || kind === "html" || !src) return node;
      const natural = await resolveNaturalMediaNodeSize(kind, src);
      if (!natural) return node;
      return {
        ...node,
        data: { ...node.data, width: natural.width, height: natural.height },
      };
    }),
  );
}

/** Stamp each node with its current busy state (creating / updating). */
export function withActivity(nodes: Node[], busy: FileBusy): Node[] {
  let changed = false;
  const next = nodes.map((node) => {
    const path = filePath(node);
    const activity = path ? busy.get(path) : undefined;
    if (activity === (node.data as { fileActivity?: string })?.fileActivity) {
      return node;
    }
    changed = true;
    return { ...node, data: { ...node.data, fileActivity: activity } };
  });
  return changed ? next : nodes;
}

/** Build a canvas document from file nodes (ignores ephemeral generate nodes). */
export function documentFromNodes(nodes: Node[]): CanvasDocument {
  const files = nodes.filter((n) => filePath(n));
  const order = files
    .slice()
    .sort(
      (a, b) =>
        a.position.x - b.position.x ||
        a.position.y - b.position.y ||
        String(filePath(a)).localeCompare(String(filePath(b))),
    )
    .map((n) => String(filePath(n)));

  const positions: CanvasDocument["nodes"] = {};
  for (const node of files) positions[filePath(node)!] = { ...node.position };
  return { nodes: positions, order };
}

/** Keep the saved order, dropping gone files and appending new ones. */
function mergeDocument(prev: CanvasDocument | null, placed: Node[]): CanvasDocument {
  const next = documentFromNodes(placed);
  if (!prev) return next;

  const live = new Set(next.order);
  const seen = new Set<string>();
  const order: string[] = [];
  for (const path of [...prev.order, ...next.order]) {
    if (!live.has(path) || seen.has(path)) continue;
    seen.add(path);
    order.push(path);
  }
  return { nodes: next.nodes, order };
}

function ephemeralFor(prev: Node[], wsId: string): Node[] {
  return prev.filter(
    (n) =>
      isGenerateNode(n) &&
      (n.data as { workspaceId?: string })?.workspaceId === wsId,
  );
}

/** Saved order first, then any new files, so placement stays stable. */
function orderForLayout(resolved: Node[], layout: CanvasDocument): Node[] {
  const byPath = new Map(resolved.map((n) => [filePath(n)!, n]));
  const seen = new Set<string>();
  const ordered: Node[] = [];

  const push = (path: string) => {
    if (seen.has(path)) return;
    const node = byPath.get(path);
    if (!node) return;
    seen.add(path);
    ordered.push(node);
  };

  layout.order.forEach(push);
  Object.keys(layout.nodes).forEach(push);
  resolved.forEach((n) => push(filePath(n)!));
  return ordered;
}

/** Place nodes using saved positions; new files land beside the last one. */
function applyStoredLayout(
  resolved: Node[],
  layout: CanvasDocument,
  anchor: Node[],
  prevById: Map<string, Node>,
): { nodes: Node[]; newNodeIds: string[] } {
  const ordered = orderForLayout(resolved, layout);
  const placedById = new Map<string, Node>();
  const positioned: Node[] = [...anchor];
  const newNodeIds: string[] = [];

  const place = (node: Node, position: { x: number; y: number }) => {
    const placed: Node = {
      ...node,
      position,
      selected: prevById.get(node.id)?.selected ?? false,
    };
    placedById.set(node.id, placed);
    positioned.push(placed);
  };

  for (const node of ordered) {
    const saved = layout.nodes[filePath(node)!];
    if (saved) place(node, saved);
  }
  for (const node of ordered) {
    if (layout.nodes[filePath(node)!]) continue;
    newNodeIds.push(node.id);
    place(node, placeNodeBesideLast(positioned, node));
  }

  return { nodes: resolved.map((n) => placedById.get(n.id)!), newNodeIds };
}

/**
 * Sync design files → canvas nodes using the persisted layout when available.
 *
 * Busy state (the loading frame) is owned by file events, not by this sync —
 * we only stamp the current `busy` map onto nodes so creating/updating frames
 * keep showing their overlay until the watcher reports the write burst ended.
 */
export async function syncCanvasNodes(input: {
  data: DesignData | undefined;
  prev: Node[];
  activeWs: string | undefined;
  storage: CanvasStorage;
  forceLayout?: boolean;
  fileBusy: FileBusy;
  workspaceChanged?: boolean;
}): Promise<SyncCanvasResult> {
  const { data, prev, activeWs, storage, forceLayout, fileBusy, workspaceChanged } =
    input;

  if (!activeWs || !data?.files.length) {
    return { nodes: [], newNodeIds: [], fitAll: false };
  }

  const wsRev = data.rev ?? 0;
  const resolved = await withMediaSizes(
    data.files.map((file) => makeFileNode(data.id, file, wsRev)),
  );
  const ephemeral = ephemeralFor(prev, activeWs);
  const stored = forceLayout ? null : storage.load(data.id);

  let placed: Node[];
  let newNodeIds: string[] = [];
  let fitAll: boolean;

  if (!stored) {
    placed = layoutNodes(resolved);
    storage.save(data.id, documentFromNodes(placed));
    fitAll = true;
  } else {
    const prevById = new Map(prev.map((n) => [n.id, n]));
    const result = applyStoredLayout(resolved, stored, ephemeral, prevById);
    placed = result.nodes;
    newNodeIds = result.newNodeIds;
    fitAll = !!workspaceChanged;
    storage.save(data.id, mergeDocument(stored, placed));
  }

  const nodes = withActivity([...placed, ...ephemeral], fileBusy);
  return { nodes, newNodeIds, fitAll };
}

/** Bust preview cache so iframes reload while the agent is still writing. */
export function bumpNodePreviewSrc(nodes: Node[], path: string): Node[] {
  const stamp = Date.now();
  let changed = false;
  const next = nodes.map((node) => {
    if ((node.data as { filePath?: string })?.filePath !== path) return node;
    const src = node.data?.src ? String(node.data.src) : "";
    if (!src) return node;
    changed = true;
    const busted = src.replace(/([?&]v=)\d+/, `$1${stamp}`);
    return {
      ...node,
      data: {
        ...node.data,
        src:
          busted !== src
            ? busted
            : `${src}${src.includes("?") ? "&" : "?"}v=${stamp}`,
      },
    };
  });
  return changed ? next : nodes;
}
