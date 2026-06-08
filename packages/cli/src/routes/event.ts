import { Bus } from "@/util/bus";
import { projectDirFromRequest } from "@/util/project-dir";
import { Log } from "@/util/log";
import type { Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";

const log = Log.create({ name: "event" });

function streamWorkspaceEvents(c: Context) {
  const workspace = c.req.query("workspace")?.trim();
  if (!workspace) {
    return c.json({ error: "Missing workspace query" }, 400);
  }

  const dir = projectDirFromRequest(c);
  if (!dir) {
    return c.json(
      { error: "Missing project scope (x-dddx-project or /p/<slug>/event)" },
      400,
    );
  }

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      data: JSON.stringify({
        type: "server.connected",
        properties: { workspace },
      }),
    });

    const unsub = Bus.subscribeWorkspace(dir, workspace, async (payload) => {
      await stream.writeSSE({
        data: JSON.stringify(payload),
      });
      if (payload.type === Bus.ServerDisposed.type) {
        stream.close();
      }
    });

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        unsub();
        log.info("event disconnected", { directory: dir, workspace });
        resolve();
      });
    });
  });
}

export function event(app: Hono) {
  app.get("/p/:slug/event", streamWorkspaceEvents);
  app.get("/event", streamWorkspaceEvents);
}
