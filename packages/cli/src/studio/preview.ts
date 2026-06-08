import path from "node:path";

export type PreviewTarget = {
  id: string;
  label: string;
  url: string;
  port: number;
  path?: string;
};

/** In-memory preview URLs for the running studio worker (never persisted). */
const byProject = new Map<string, PreviewTarget[]>();

export function setPreviewTargets(
  projectDir: string,
  targets: PreviewTarget[],
): void {
  byProject.set(path.resolve(projectDir), targets);
}

export function getPreviewTargets(projectDir: string): {
  targets: PreviewTarget[];
  defaultTargetId: string | null;
} {
  let dir = path.resolve(projectDir);
  for (;;) {
    const targets = byProject.get(dir);
    if (targets?.length) {
      return { targets, defaultTargetId: targets[0]?.id ?? null };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return { targets: [], defaultTargetId: null };
    dir = parent;
  }
}

export function clearPreviewTargets(projectDir: string): void {
  byProject.delete(path.resolve(projectDir));
}
