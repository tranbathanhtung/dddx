/** @jsx jsx */
/** @jsxImportSource hono/jsx */

import { serve, type ServerType } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { raw } from "hono/html";
import fkill from "fkill";

import { AgentManager } from "@/agents/manager";
import { Mcp } from "@/mcp/mcp";
import { designs } from "@/routes/designs";
import { event } from "@/routes/event";
import { send } from "@/routes/chat";
import { templates } from "@/routes/templates";
import { appRouter } from "@/routes";
import { Bus } from "@/util/bus";
import { FileWatcher } from "@/util/filewatcher";
import { Log } from "@/util/log";
import { Sdk } from "@/util/sdk-origin";
import {
  LISTEN_HOST,
  localDevHostnameCheckJs,
  resolveStudioPort,
} from "@/util/service-endpoints";
import { projectDirFromRequest } from "@/util/project-dir";
import { trpcServer } from "@hono/trpc-server";

import {
  attachStudioServer,
  STUDIO_SERVICE,
  type StudioHandle,
} from "./registry";
import {
  clearPreviewTargets,
  setPreviewTargets,
  type PreviewTarget,
} from "./preview";
import {
  createStudioSessionManager,
  type StudioSessionManager,
} from "./session";
import { FAVICON_SVG } from "./favicon";

const log = Log.create({ service: "studio.app" });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Options {
  port?: number;
  /** Studio worker only — invoked when all CLI sessions have disconnected. */
  onShutdown?: () => void;
  /** Dev CLI — sync preview targets before each attach (including reconnects). */
  onBeforeAttach?: () => void | Promise<void>;
}

async function disposeProjectAgents(
  dir: string,
  agentManager: AgentManager,
): Promise<void> {
  await agentManager.disposeForDirectory(dir);
  await Bus.disposeDirectory(dir);
}

/** Full project teardown — clears preview targets and agent state. */
async function releaseProjectScope(
  dir: string,
  agentManager: AgentManager,
): Promise<void> {
  clearPreviewTargets(dir);
  await disposeProjectAgents(dir, agentManager);
}

export function createStudioApp(
  agentManager: AgentManager,
  sessions?: StudioSessionManager,
): Hono {
  const app = new Hono();

  app.use("*", cors());
  Mcp.mount(app);
  send(app, agentManager);
  event(app);
  templates(app);
  designs(app);
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext(_opts, c) {
        return {
          dir: projectDirFromRequest(c),
          agentManager,
        };
      },
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok", service: STUDIO_SERVICE }));

  app.get("/favicon.svg", (c) =>
    c.body(FAVICON_SVG, 200, { "Content-Type": "image/svg+xml" }),
  );

  app.post("/studio/release", async (c) => {
    const dir = projectDirFromRequest(c);
    if (!dir) {
      return c.json({ error: "Missing project scope (x-dddx-project)" }, 400);
    }

    await releaseProjectScope(dir, agentManager);
    log.info("project released", { directory: dir });
    return c.json({ ok: true });
  });

  app.post("/studio/preview", async (c) => {
    const dir = projectDirFromRequest(c);
    if (!dir) {
      return c.json({ error: "Missing project scope (x-dddx-project)" }, 400);
    }

    const body = (await c.req.json()) as { targets?: PreviewTarget[] };
    if (!Array.isArray(body.targets)) {
      return c.json({ error: "Expected { targets: [] }" }, 400);
    }

    setPreviewTargets(dir, body.targets);
    return c.json({ ok: true });
  });

  if (sessions) {
    app.post("/studio/attach", async (c) => {
      const dir = projectDirFromRequest(c);
      if (!dir) {
        return c.json({ error: "Missing project scope (x-dddx-project)" }, 400);
      }

      let cliPid: number;
      try {
        const body = (await c.req.json()) as { cliPid?: number };
        cliPid = body.cliPid ?? Number.NaN;
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }

      if (!Number.isFinite(cliPid)) {
        return c.json({ error: "Expected { cliPid: number }" }, 400);
      }

      await sessions.holdUntilDisconnect(dir, cliPid, c.req.raw.signal);
      return c.body(null, 204);
    });
  }

  app.get("*", (c) =>
    c.html(
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>Dream, Design, Develop</title>
          <style>
            {raw(`
              body {
                font-family: "Inter", system-ui, sans-serif;
              }
            `)}
          </style>
          <script>
            {raw(`
if (${localDevHostnameCheckJs()}) {
  (window.dddx ??= {}).url = location.origin;
  const s = document.createElement("script");
  s.src = ${JSON.stringify(Sdk.asset("index.js"))};
  s.type = "module";
  document.head.appendChild(s);
}
`)}
          </script>
        </head>
        <body>
          <div id="root" />
        </body>
      </html>,
    ),
  );

  return app;
}

/** Run the studio HTTP server in the current process (studio worker only). */
export async function startStudioServerInProcess(options: Options = {}) {
  const port = resolveStudioPort();
  const agentManager = new AgentManager();

  let sessions: StudioSessionManager | undefined;
  if (options.onShutdown) {
    sessions = createStudioSessionManager({
      workerPid: process.pid,
      port,
      // Attach disconnects are often transient (worker restart, network blip).
      // Keep preview targets until an explicit /studio/release.
      onProjectReleased: (dir) => disposeProjectAgents(dir, agentManager),
      onShutdown: options.onShutdown,
    });
  }

  const app = createStudioApp(agentManager, sessions);
  const server = await listenWithRetry(app, port);
  sessions?.start();

  log.info("worker listening", { port });

  let stopping: Promise<void> | null = null;
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      sessions?.stop();
      await agentManager.disposeAll();
      await FileWatcher.disposeAll();
      await Bus.disposeAll();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    })();
    return stopping;
  };

  return { port, server, close: stop, sessions };
}

/**
 * Attach this CLI process to the shared studio worker. Spawns the worker when
 * none is listening yet.
 */
export async function startStudioServer(
  options: Options = {},
): Promise<StudioHandle> {
  const port = options.port ?? resolveStudioPort();
  return attachStudioServer(process.cwd(), port, {
    onBeforeAttach: options.onBeforeAttach,
  });
}

async function listenWithRetry(app: Hono, port: number): Promise<ServerType> {
  return new Promise<ServerType>((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname: LISTEN_HOST });

    const onError = async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EADDRINUSE") {
        reject(error);
        return;
      }
      await fkill(`:${port}`, { force: true, silent: true }).catch(() => {});
      await sleep(150);
      try {
        const retry = serve({ fetch: app.fetch, port, hostname: LISTEN_HOST });
        retry.once("error", reject);
        retry.once("listening", () => resolve(retry));
      } catch (err) {
        reject(err);
      }
    };

    server.once("error", onError);
    server.once("listening", () => resolve(server));
  });
}
