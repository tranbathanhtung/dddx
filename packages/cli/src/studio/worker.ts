/**
 * Detached studio server process. One worker serves every `dddx` CLI instance;
 * each project is scoped by the studio URL `/p/<slug>` path.
 *
 * Each CLI holds an open `/studio/attach` connection as a lease — when the
 * last lease drops (including `kill -9`), the worker shuts itself down.
 */

import { ProcessLifecycle } from "@/util/lifecycle";
import { Log } from "@/util/log";
import { clearRegistryIfOwned, resolveStudioPort } from "./registry";
import { startStudioServerInProcess } from "./app";

export async function runStudioWorker(): Promise<void> {
  Log.init({ debug: Log.envDebugEnabled(), print: false });

  const port = resolveStudioPort();
  if (Number.isNaN(port) || port <= 0) {
    console.error("[dddx] Invalid DDDX_STUDIO_PORT");
    process.exit(1);
  }

  let shuttingDown = false;
  let studio: Awaited<ReturnType<typeof startStudioServerInProcess>> | null =
    null;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void (async () => {
      await clearRegistryIfOwned(port, process.pid);
      await studio?.close();
      ProcessLifecycle.forceExit(0, { killAfterMs: 3_000 });
    })();
  };

  studio = await startStudioServerInProcess({ port, onShutdown: shutdown });

  process.stdout.write("ready\n");

  ProcessLifecycle.register({
    scope: "studio-worker",
    label: "studio worker",
    onSignal: shutdown,
    onFatal: () => shutdown(),
  });
}

if (import.meta.main) {
  await runStudioWorker();
}
