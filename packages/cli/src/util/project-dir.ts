import type { Context } from "hono";
import { resolveProjectDirFromSlug } from "@/studio";

/** Extract the project slug from a `/p/<slug>` path prefix. */
export function slugFromPath(pathname: string): string {
  const match = pathname.match(/^\/p\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function projectDirFromReferer(
  referer: string | undefined,
): string | null {
  if (!referer) return null;

  try {
    const pathSlug = slugFromPath(new URL(referer).pathname);
    if (!pathSlug) return null;
    return resolveProjectDirFromSlug(pathSlug);
  } catch {
    return null;
  }
}

/**
 * Resolve the project root for a request.
 *
 * - API / fetch: pass `x-dddx-project` (readable slug from `/p/<slug>`).
 * - iframe / asset previews: use Referer from the studio page (`/p/<slug>`).
 * - Path-scoped routes (`/p/<slug>/event`, designs, templates): slug in the path.
 */
export function projectDirFromRequest(c: Context): string {
  const fromProjectHeader = c.req.header("x-dddx-project") ?? "";
  if (fromProjectHeader) {
    const dir = resolveProjectDirFromSlug(fromProjectHeader);
    if (dir) return dir;
  }

  const fromPath = slugFromPath(c.req.path);
  if (fromPath) {
    const dir = resolveProjectDirFromSlug(fromPath);
    if (dir) return dir;
  }

  const fromReferer = projectDirFromReferer(c.req.header("referer"));
  if (fromReferer) return fromReferer;

  return "";
}
