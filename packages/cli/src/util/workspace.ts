import path from "path";
import { readdir } from "fs/promises";
import { Filesystem } from "./filesystem";
import { appDir } from "./global";

/** Prototype sandboxes live under `.dddx/designs/<name>`. */
export const DESIGN_PROTOTYPES_DIR = path.join(appDir, "designs");

export const MAIN_FOLDER_ID = "main";

export namespace Workspace {
  export function resolve(root: string, id: string | null | undefined): string {
    if (!id || id === MAIN_FOLDER_ID) {
      return root;
    }
    return path.join(root, DESIGN_PROTOTYPES_DIR, id);
  }

  /**
   * Absolute path of the focus folder for a chat workspace, or `null` for the
   * main project. Used to build the focus hint that gets prepended to chat
   * turns originating from a design prototype while keeping the ACP session
   * cwd anchored at the project root.
   */
  export function focus(
    root: string,
    id: string | null | undefined,
  ): string | null {
    if (!id || id === MAIN_FOLDER_ID) return null;
    return path.join(root, DESIGN_PROTOTYPES_DIR, id);
  }

  /** Treats main / unset as `MAIN_FOLDER_ID`. */
  export function normalize(id: string | null | undefined): string {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (!trimmed) return MAIN_FOLDER_ID;
    return trimmed;
  }

  export async function list(root: string): Promise<WorkspaceFolder[]> {
    const name = path.basename(root);
    const folders: WorkspaceFolder[] = [
      {
        id: MAIN_FOLDER_ID,
        name,
        path: root,
        kind: "main",
      },
    ];

    const designRoot = path.join(root, DESIGN_PROTOTYPES_DIR);

    if (!(await Filesystem.isDir(designRoot))) {
      return folders;
    }

    const entries = await readdir(designRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      folders.push({
        id: entry.name,
        name: entry.name,
        path: path.join(designRoot, entry.name),
        kind: "prototype",
      });
    }

    return folders;
  }

  export async function create(
    root: string,
    name: string,
  ): Promise<WorkspaceFolder> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Prototype name is required");
    }
    if (trimmed === MAIN_FOLDER_ID) {
      throw new Error(`"${MAIN_FOLDER_ID}" is reserved`);
    }

    const target = path.join(root, DESIGN_PROTOTYPES_DIR, trimmed);
    await Filesystem.ensureDir(target);

    return {
      id: trimmed,
      name: trimmed,
      path: target,
      kind: "prototype",
    };
  }
}

export type WorkspaceFolder = {
  id: string;
  name: string;
  path: string;
  kind: "main" | "prototype";
};
