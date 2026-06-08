import {
  currentProjectSlug,
  useStudioStore,
  type CanvasDocument,
} from "@/store";

export type { CanvasDocument };

export interface CanvasStorage {
  load(workspaceId: string): CanvasDocument | null;
  save(workspaceId: string, doc: CanvasDocument): void;
  remove?(workspaceId: string): void;
}

function normalize(doc: CanvasDocument | undefined): CanvasDocument | null {
  if (!doc?.nodes || typeof doc.nodes !== "object") return null;
  return {
    nodes: doc.nodes,
    order: Array.isArray(doc.order) ? doc.order : [],
  };
}

/** Reads/writes canvas layouts via the persisted studio store. */
export class LocalCanvasStorage implements CanvasStorage {
  load(workspaceId: string): CanvasDocument | null {
    const slug = currentProjectSlug();
    return normalize(
      useStudioStore.getState().projects[slug]?.canvas?.[workspaceId],
    );
  }

  save(workspaceId: string, doc: CanvasDocument): void {
    useStudioStore.getState().canvas.save(workspaceId, doc);
  }

  remove(workspaceId: string): void {
    useStudioStore.getState().canvas.remove(workspaceId);
  }
}

/** Swap this instance to plug in API / filesystem storage later. */
export const canvasStorage: CanvasStorage = new LocalCanvasStorage();
