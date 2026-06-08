import fs from "fs/promises";
import fsSync from "node:fs";
import path from "path";
import { spawn, type ChildProcess } from "node:child_process";

import { findPidOnPort } from "@/portless/cli-utils";
import { Log } from "@/util/log";
import { getProjectSlug, projectSlugLabel } from "@/util/project-name";
import {
  connectUrl,
  DEFAULT_STUDIO_PORT,
  displayUrl,
  resolveStudioPort,
} from "@/util/service-endpoints";

import {
  addAttachment,
  countProjectAttachments,
  isPidRunning,
  liveAttachments,
  removeAttachment,
  type StudioAttachment,
  type StudioRegistry,
} from "./attachments";
import { REGISTRY_PATH, SPAWN_LOCK_PATH } from "./paths";
import type { PreviewTarget } from "./preview";

const log = Log.create({ service: "studio.registry" });

export const STUDIO_SERVICE = "dddx-studio";

export {
  DEFAULT_STUDIO_PORT,
  resolveStudioPort,
} from "@/util/service-endpoints";

export type { StudioAttachment, StudioRegistry };

const SPAWN_LOCK_STALE_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type LegacyStudioRegistry = {
  port: number;
  pid: number;
  clients?: Record<string, number>;
  attachments?: StudioAttachment[];
};

type SpawnLock = {
  pid: number;
  port: number;
  at: number;
};

export type StudioHandle = {
  port: number;
  url: string;
  /** True when this project had no live CLI attachment in studio.json yet. */
  firstProjectAttach: boolean;
  close: () => Promise<void>;
};

export type StudioAttachHooks = {
  /** Invoked before each attach attempt, including reconnects after worker restarts. */
  onBeforeAttach?: () => void | Promise<void>;
};

export type ActiveStudioProject = {
  directory: string;
  name: string;
  slug: string;
  initial: string;
};

const WORKER_BLOCKED_FLAGS = new Set([
  "--hot",
  "-hot",
  "--watch",
  "-watch",
  "--watch-path",
]);

function isBlockedWorkerFlag(arg: string): boolean {
  return (
    WORKER_BLOCKED_FLAGS.has(arg) ||
    arg.startsWith("--hot=") ||
    arg.startsWith("--watch=")
  );
}

function workerFlagConsumesNextArg(arg: string): boolean {
  return arg === "--watch" || arg === "-watch" || arg === "--watch-path";
}

/** Strip dev-only Bun flags so the detached worker can exit cleanly. */
export function workerExecArgv(
  execArgv: string[] = process.execArgv,
): string[] {
  const filtered: string[] = [];
  for (let i = 0; i < execArgv.length; i++) {
    const arg = execArgv[i];
    if (arg == null) continue;
    if (isBlockedWorkerFlag(arg)) {
      if (workerFlagConsumesNextArg(arg)) i++;
      continue;
    }
    filtered.push(arg);
  }
  return filtered;
}

/**
 * Launch the worker via the same CLI entry as the parent process. Reuses the
 * bundled `dddx` binary (or `src/cli.ts` in dev) instead of a separate
 * studio-worker bundle that would duplicate the entire server stack.
 */
function workerLaunch(): { command: string; args: string[] } {
  const entry = process.argv[1];
  if (!entry) {
    throw new Error("Cannot resolve CLI entry for studio worker spawn");
  }

  return {
    command: process.execPath,
    args: [...workerExecArgv(), entry, "_studio-worker"],
  };
}

export function studioUrl(port: number, projectDir: string): string {
  const slug = getProjectSlug(projectDir);
  return displayUrl(port, `/p/${encodeURIComponent(slug)}`);
}

function normalizeRegistry(
  raw: LegacyStudioRegistry | null,
): StudioRegistry | null {
  if (!raw || typeof raw.port !== "number" || typeof raw.pid !== "number") {
    return null;
  }

  if (Array.isArray(raw.attachments)) {
    return {
      port: raw.port,
      pid: raw.pid,
      attachments: raw.attachments.filter(
        (entry) =>
          typeof entry?.projectDir === "string" &&
          typeof entry?.cliPid === "number",
      ),
    };
  }

  if (raw.clients && Object.keys(raw.clients).length > 0) {
    log.warn(
      "legacy studio registry without cli pids — resetting attachments",
      {
        clients: raw.clients,
      },
    );
  }

  return { port: raw.port, pid: raw.pid, attachments: [] };
}

async function readRegistry(): Promise<StudioRegistry | null> {
  try {
    const raw = JSON.parse(
      await fs.readFile(REGISTRY_PATH, "utf8"),
    ) as LegacyStudioRegistry | null;
    return normalizeRegistry(raw);
  } catch {
    return null;
  }
}

/** Live CLI attachments grouped by project directory (studio project switcher). */
export async function listActiveStudioProjects(): Promise<
  ActiveStudioProject[]
> {
  const registry = await readRegistry();
  if (!registry) return [];

  const seen = new Set<string>();
  const projects: ActiveStudioProject[] = [];

  for (const entry of liveAttachments(registry)) {
    const directory = path.resolve(entry.projectDir);
    if (seen.has(directory)) continue;
    seen.add(directory);

    const slug = getProjectSlug(directory);
    const name = projectSlugLabel(slug);
    projects.push({
      directory,
      name,
      slug,
      initial: name.charAt(0).toUpperCase() || "?",
    });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

async function writeRegistry(registry: StudioRegistry): Promise<void> {
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

async function clearRegistry(): Promise<void> {
  await fs.rm(REGISTRY_PATH, { force: true });
}

/** Drop the registry file when this worker owns it (worker self-shutdown). */
export async function clearRegistryIfOwned(
  port: number,
  pid: number,
): Promise<void> {
  const registry = await readRegistry();
  if (registry && registry.port === port && registry.pid === pid) {
    await clearRegistry();
  }
}

export async function probeStudioHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(connectUrl(port, "/health"), {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { service?: string };
    return body.service === STUDIO_SERVICE;
  } catch {
    return false;
  }
}

async function waitForStudioHealth(
  port: number,
  timeoutMs = 15_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeStudioHealth(port)) return true;
    await sleep(100);
  }
  return false;
}

async function releaseProjectOnServer(
  port: number,
  projectDir: string,
): Promise<void> {
  try {
    await fetch(connectUrl(port, "/studio/release"), {
      method: "POST",
      headers: {
        "x-dddx-project": getProjectSlug(projectDir),
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    log.warn("studio release request failed", {
      projectDir,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function registerPreviewTargets(
  port: number,
  projectDir: string,
  targets: PreviewTarget[],
): Promise<void> {
  try {
    const response = await fetch(connectUrl(port, "/studio/preview"), {
      method: "POST",
      headers: {
        "x-dddx-project": getProjectSlug(projectDir),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targets }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.warn("preview targets registration rejected", {
        projectDir,
        status: response.status,
        body,
      });
    }
  } catch (err) {
    log.warn("preview targets registration failed", {
      projectDir,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function signalWorker(pid: number, signal: NodeJS.Signals): void {
  if (!isPidRunning(pid)) return;
  try {
    process.kill(pid, signal);
  } catch {
    // already gone
  }
}

async function stopWorker(pid: number): Promise<void> {
  signalWorker(pid, "SIGTERM");

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isPidRunning(pid)) return;
    await sleep(100);
  }

  signalWorker(pid, "SIGKILL");
}

/** Best-effort synchronous kill for `process.on("exit")` handlers. */
export function killStudioWorkerSync(port = DEFAULT_STUDIO_PORT): void {
  let raw: { port?: number; pid?: number } | null = null;
  try {
    raw = JSON.parse(fsSync.readFileSync(REGISTRY_PATH, "utf8"));
  } catch {
    return;
  }

  if (raw?.port !== port || typeof raw?.pid !== "number") return;
  signalWorker(raw.pid, "SIGTERM");
}

async function readSpawnLock(): Promise<SpawnLock | null> {
  try {
    const raw = JSON.parse(
      await fs.readFile(SPAWN_LOCK_PATH, "utf8"),
    ) as SpawnLock;
    if (
      typeof raw.pid !== "number" ||
      typeof raw.port !== "number" ||
      typeof raw.at !== "number"
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

async function clearSpawnLock(): Promise<void> {
  await fs.rm(SPAWN_LOCK_PATH, { force: true });
}

async function isSpawnLockStale(
  lock: SpawnLock,
  port: number,
): Promise<boolean> {
  if (!isPidRunning(lock.pid)) return true;
  if (Date.now() - lock.at > SPAWN_LOCK_STALE_MS) return true;
  if (lock.port === port && (await probeStudioHealth(port))) return true;
  return false;
}

async function acquireSpawnLock(port: number): Promise<() => Promise<void>> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      await fs.writeFile(
        SPAWN_LOCK_PATH,
        JSON.stringify({ pid: process.pid, port, at: Date.now() }),
        { flag: "wx" },
      );
      return clearSpawnLock;
    } catch {
      const existing = await readSpawnLock();
      if (!existing || (await isSpawnLockStale(existing, port))) {
        await clearSpawnLock();
        continue;
      }

      if (await probeStudioHealth(port)) {
        throw new Error("STUDIO_ALREADY_RUNNING");
      }

      await sleep(100);
    }
  }

  throw new Error(`Timed out waiting for studio spawn lock on port ${port}`);
}

async function spawnStudioWorker(port: number): Promise<number> {
  const { command, args } = workerLaunch();
  const debug = Log.envDebugEnabled();
  const child: ChildProcess = spawn(command, args, {
    env: {
      ...process.env,
      DDDX_STUDIO_PORT: String(port),
    },
    detached: true,
    // In debug mode inherit stderr so worker logs (e.g. /api/chat) reach the CLI terminal.
    stdio: debug ? ["ignore", "pipe", "inherit"] : ["ignore", "pipe", "ignore"],
  });

  child.unref();

  if (!child.pid) {
    throw new Error("Failed to spawn studio worker");
  }

  const ready = await waitForStudioHealth(port);
  if (!ready) {
    await stopWorker(child.pid);
    throw new Error(`Studio worker did not become ready on port ${port}`);
  }

  return child.pid;
}

async function syncWorkerPid(
  registry: StudioRegistry,
  port: number,
): Promise<StudioRegistry> {
  const healthOk = await probeStudioHealth(port);
  if (!healthOk) return registry;

  const pid = findPidOnPort(port);
  if (pid && pid !== registry.pid) {
    return { ...registry, pid };
  }
  return registry;
}

/**
 * Drop dead CLI attachments and release project scopes that no longer have
 * any live CLI attached. Returns the reconciled registry, or null when the
 * worker is gone and the registry should be discarded.
 */
export async function reconcileRegistry(
  registry: StudioRegistry,
  port: number,
): Promise<StudioRegistry | null> {
  registry = await syncWorkerPid(registry, port);

  const healthOk = await probeStudioHealth(port);
  const workerAlive =
    healthOk && (isPidRunning(registry.pid) || findPidOnPort(port) !== null);

  if (!workerAlive) {
    const removedProjects = [
      ...new Set(registry.attachments.map((entry) => entry.projectDir)),
    ];
    for (const projectDir of removedProjects) {
      await releaseProjectOnServer(port, projectDir);
    }
    return null;
  }

  const live = liveAttachments(registry);
  const removed = registry.attachments.filter(
    (entry) => !live.some((item) => item.cliPid === entry.cliPid),
  );

  const releasedProjects = new Set<string>();
  for (const entry of removed) {
    const liveForProject = countProjectAttachments(live, entry.projectDir);
    const removedForProject = removed.filter(
      (item) => item.projectDir === entry.projectDir,
    ).length;
    const previousForProject = countProjectAttachments(
      registry.attachments,
      entry.projectDir,
    );

    if (
      liveForProject === 0 &&
      removedForProject === previousForProject &&
      !releasedProjects.has(entry.projectDir)
    ) {
      releasedProjects.add(entry.projectDir);
      await releaseProjectOnServer(port, entry.projectDir);
      log.info("reconciled dead cli attachment", {
        projectDir: entry.projectDir,
        cliPid: entry.cliPid,
      });
    }
  }

  return { ...registry, attachments: live };
}

async function resolveLiveRegistry(
  port: number,
): Promise<StudioRegistry | null> {
  let registry = await readRegistry();

  if (!registry || registry.port !== port) {
    if (await probeStudioHealth(port)) {
      const pid = findPidOnPort(port);
      if (pid) {
        registry = { port, pid, attachments: [] };
        return reconcileRegistry(registry, port);
      }
    }
    return null;
  }

  return reconcileRegistry(registry, port);
}

async function ensureWorker(
  port: number,
): Promise<{ registry: StudioRegistry; spawned: boolean }> {
  let registry = await resolveLiveRegistry(port);
  if (registry) return { registry, spawned: false };

  let releaseLock: (() => Promise<void>) | null = null;
  try {
    releaseLock = await acquireSpawnLock(port);
  } catch (err) {
    if (err instanceof Error && err.message === "STUDIO_ALREADY_RUNNING") {
      registry = await resolveLiveRegistry(port);
      if (registry) return { registry, spawned: false };
    }
    throw err;
  }

  try {
    registry = await resolveLiveRegistry(port);
    if (registry) return { registry, spawned: false };

    const pid = await spawnStudioWorker(port);
    return {
      registry: { port, pid, attachments: [] },
      spawned: true,
    };
  } finally {
    await releaseLock?.();
  }
}

async function detachStudioClient(
  port: number,
  projectDir: string,
  cliPid: number,
): Promise<void> {
  let current = await readRegistry();
  if (!current || current.port !== port) return;

  current = (await reconcileRegistry(current, port)) ?? current;

  const before = countProjectAttachments(current.attachments, projectDir);
  const next = removeAttachment(current, projectDir, cliPid);
  const after = countProjectAttachments(next.attachments, projectDir);
  const noClientsLeft = next.attachments.length === 0;

  // Stop the worker immediately when we're the last CLI. Do not block on HTTP
  // release — the dev teardown timeout can exit the process before SIGTERM.
  if (noClientsLeft) {
    void stopWorker(next.pid);
  }

  if (before > 0 && after === 0) {
    await releaseProjectOnServer(port, projectDir);
  }

  if (noClientsLeft) {
    await clearRegistry();
    log.info("studio stopped", { port });
    return;
  }

  await writeRegistry(next);
  log.info("studio detached", { port, projectDir, cliPid });
}

/**
 * Attach this CLI process to the shared studio server, spawning the worker
 * when none is running yet.
 */
export async function attachStudioServer(
  projectDir: string,
  port = DEFAULT_STUDIO_PORT,
  hooks: StudioAttachHooks = {},
): Promise<StudioHandle> {
  const resolved = path.resolve(projectDir);
  const cliPid = process.pid;

  const { registry: initial, spawned } = await ensureWorker(port);
  const firstProjectAttach =
    countProjectAttachments(initial.attachments, resolved) === 0;
  let registry = addAttachment(initial, resolved, cliPid);
  await writeRegistry(registry);

  const url = studioUrl(port, resolved);
  log.info(spawned ? "listening" : "attached", {
    url,
    port,
    projectDir: resolved,
    cliPid,
    firstProjectAttach,
  });

  const releaseSession = holdStudioSession(
    port,
    resolved,
    cliPid,
    hooks.onBeforeAttach,
  );

  let closing: Promise<void> | null = null;
  const close = () => {
    if (closing) return closing;
    releaseSession();
    closing = detachStudioClient(port, resolved, cliPid);
    return closing;
  };

  return { port, url, firstProjectAttach, close };
}

/** Keep an open attach lease so the worker knows this CLI is alive. */
function holdStudioSession(
  port: number,
  projectDir: string,
  cliPid: number,
  onBeforeAttach?: () => void | Promise<void>,
): () => void {
  const controller = new AbortController();
  const slug = getProjectSlug(projectDir);

  void (async () => {
    while (!controller.signal.aborted) {
      try {
        await onBeforeAttach?.();
        await fetch(connectUrl(port, "/studio/attach"), {
          method: "POST",
          headers: {
            "x-dddx-project": slug,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cliPid }),
          signal: controller.signal,
        });
        break;
      } catch {
        if (controller.signal.aborted) break;
        await sleep(1000);
      }
    }
  })();

  return () => controller.abort();
}
