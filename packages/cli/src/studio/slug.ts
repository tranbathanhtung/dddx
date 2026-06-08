import { readFileSync } from "node:fs";
import path from "node:path";

import { getProjectSlug } from "@/util/project-name";

import { liveAttachments, type StudioRegistry } from "./attachments";
import { REGISTRY_PATH } from "./paths";

function readRegistry(): StudioRegistry | null {
  try {
    const raw = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as StudioRegistry;
    if (!raw || !Array.isArray(raw.attachments)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Resolve a project slug to cwd using live CLI attachments in studio.json. */
export function resolveProjectDirFromSlug(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const registry = readRegistry();
  if (!registry) return null;

  for (const entry of liveAttachments(registry)) {
    const dir = path.resolve(entry.projectDir);
    if (getProjectSlug(dir) === trimmed) return dir;
  }

  return null;
}
