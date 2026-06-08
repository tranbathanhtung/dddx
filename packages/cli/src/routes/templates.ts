import type { Context, Hono } from "hono";

import { getProjectSlug } from "@/util/project-name";
import { resolveProjectDirFromSlug } from "@/studio";
import { contentTypeFromPath } from "@/util/content-type";
import { Filesystem } from "@/util/filesystem";
import { Plugin, isRemotePreview } from "@/util/plugin";
import { projectDirFromRequest } from "@/util/project-dir";

async function assetResponse(c: Context, asset: string | null) {
  if (!asset) return c.notFound();
  if (isRemotePreview(asset)) {
    const res = await fetch(asset, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return c.notFound();
    const bytes = new Uint8Array(await res.arrayBuffer());
    return new Response(bytes, {
      headers: {
        "content-type":
          res.headers.get("content-type") ??
          contentTypeFromPath(asset) ??
          "text/html; charset=utf-8",
      },
    });
  }

  const bytes = await Filesystem.readBytes(asset);
  return new Response(bytes, {
    headers: {
      "content-type": contentTypeFromPath(asset),
    },
  });
}

export function templates(app: Hono) {
  // Project-scoped via a `/p/<token>/…` path prefix so a template preview's
  // relative assets resolve under the same prefix without a header/Referer.
  app.get("/p/:token/templates/:id/preview/html", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(
      dir,
      "templates",
      c.req.param("id"),
      "html",
    );
    return assetResponse(c, asset);
  });

  app.get("/p/:token/templates/:id/preview", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(dir, "templates", c.req.param("id"));
    return assetResponse(c, asset);
  });

  app.get("/p/:token/templates/:id/preview/panel", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(
      dir,
      "templates",
      c.req.param("id"),
      "panel",
    );
    return assetResponse(c, asset);
  });

  app.get("/p/:token/templates/:id/preview/:filename", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.previewAsset(
      dir,
      c.req.param("id"),
      c.req.param("filename"),
    );
    return assetResponse(c, asset);
  });

  app.get("/p/:token/templates/:id/:filename", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.previewAsset(
      dir,
      c.req.param("id"),
      c.req.param("filename"),
    );
    return assetResponse(c, asset);
  });

  app.get("/p/:token/themes/:id/preview/html", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(dir, "themes", c.req.param("id"), "html");
    return assetResponse(c, asset);
  });

  app.get("/p/:token/themes/:id/preview", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(dir, "themes", c.req.param("id"));
    return assetResponse(c, asset);
  });

  app.get("/p/:token/themes/:id/preview/panel", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(
      dir,
      "themes",
      c.req.param("id"),
      "panel",
    );
    return assetResponse(c, asset);
  });

  app.get("/p/:token/skills/:id/preview", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(dir, "skills", c.req.param("id"));
    return assetResponse(c, asset);
  });

  app.get("/p/:token/skills/:id/preview/panel", async (c) => {
    const token = decodeURIComponent(c.req.param("token") ?? "");
    const dir = resolveProjectDirFromSlug(token);
    if (!dir) return c.notFound();
    const asset = await Plugin.preview(dir, "skills", c.req.param("id"), "panel");
    return assetResponse(c, asset);
  });

  // Fallback for callers that scope via `x-dddx-project` or Referer (`/p/<slug>`).
  app.get("/templates/:id/preview/html", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(
      dir,
      "templates",
      c.req.param("id"),
      "html",
    );
    return assetResponse(c, asset);
  });

  app.get("/templates/:id/preview", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(dir, "templates", c.req.param("id"));
    return assetResponse(c, asset);
  });

  app.get("/templates/:id/preview/panel", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(
      dir,
      "templates",
      c.req.param("id"),
      "panel",
    );
    return assetResponse(c, asset);
  });

  app.get("/themes/:id/preview/html", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(dir, "themes", c.req.param("id"), "html");
    return assetResponse(c, asset);
  });

  app.get("/themes/:id/preview", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(dir, "themes", c.req.param("id"));
    return assetResponse(c, asset);
  });

  app.get("/themes/:id/preview/panel", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(dir, "themes", c.req.param("id"), "panel");
    return assetResponse(c, asset);
  });

  app.get("/skills/:id/preview", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(dir, "skills", c.req.param("id"));
    return assetResponse(c, asset);
  });

  app.get("/skills/:id/preview/panel", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.preview(dir, "skills", c.req.param("id"), "panel");
    return assetResponse(c, asset);
  });

  app.get("/templates/:id/preview/:filename", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.previewAsset(
      dir,
      c.req.param("id"),
      c.req.param("filename"),
    );
    return assetResponse(c, asset);
  });

  app.get("/templates/:id/:filename", async (c) => {
    const dir = projectDirFromRequest(c);
    const asset = await Plugin.previewAsset(
      dir,
      c.req.param("id"),
      c.req.param("filename"),
    );
    return assetResponse(c, asset);
  });
}
