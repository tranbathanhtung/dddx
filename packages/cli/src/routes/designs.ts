import path from "path";
import type { Context, Hono } from "hono";

import { resolveProjectDirFromSlug } from "@/studio";
import { contentTypeFromPath } from "@/util/content-type";
import { injectDevtoolsHtml } from "@/util/devtools-inject";
import { Filesystem } from "@/util/filesystem";
import { projectDirFromRequest } from "@/util/project-dir";
import { MAIN_FOLDER_ID, Workspace } from "@/util/workspace";

function subpathFromRequest(c: Context, prefix: string) {
  const wildcard = c.req.param("*");
  if (wildcard) return wildcard.replace(/^\/+/, "");

  if (c.req.path.startsWith(prefix)) {
    return c.req.path.slice(prefix.length);
  }
  return "";
}

async function serveDesignFile(
  c: Context,
  dir: string,
  workspace: string | undefined,
  rel: string,
) {
  if (!workspace || workspace === MAIN_FOLDER_ID) return c.notFound();
  if (!rel) return c.notFound();
  if (!dir) return c.notFound();

  const root = Workspace.resolve(dir, workspace);
  const abs = path.join(root, rel);

  if (!Filesystem.contains(root, abs)) return c.notFound();
  if (!(await Filesystem.exists(abs))) return c.notFound();
  if (await Filesystem.isDir(abs)) return c.notFound();

  const contentType = contentTypeFromPath(abs);
  const injectDevtools = c.req.query("dddx_devtools") === "1";

  if (injectDevtools && contentType.startsWith("text/html")) {
    const html = (await Filesystem.readBytes(abs)).toString("utf8");
    return new Response(injectDevtoolsHtml(html), {
      headers: { "content-type": contentType },
    });
  }

  const bytes = await Filesystem.readBytes(abs);
  return new Response(bytes, {
    headers: { "content-type": contentType },
  });
}

export function designs(app: Hono) {
  // Project-scoped via a URL path prefix: `/p/<slug>/designs/<ws>/<file>`.
  // The slug lives in the path so the page's *relative* assets resolve under
  // the same prefix automatically — no header or Referer needed.
  app.get("/p/:token/designs/:workspace/*", async (c) => {
    const workspace = c.req.param("workspace")?.trim();
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const rel = subpathFromRequest(
      c,
      `/p/${c.req.param("token")}/designs/${workspace}/`,
    );
    return serveDesignFile(c, dir, workspace, rel);
  });

  // Fallback for callers that scope via `x-dddx-project` or Referer (`/p/<slug>`).
  app.get("/designs/:workspace/*", async (c) => {
    const workspace = c.req.param("workspace")?.trim();
    const dir = projectDirFromRequest(c);
    const rel = subpathFromRequest(c, `/designs/${workspace}/`);
    return serveDesignFile(c, dir, workspace, rel);
  });
}
