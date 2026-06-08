import { watch, type FSWatcher } from "node:fs";
import fs from "node:fs/promises";

import { Log } from "@/util/log";

import { countProjectAttachments } from "./attachments";
import { REGISTRY_PATH } from "./paths";

const log = Log.create({ service: "studio.session" });

export type StudioSessionManagerOptions = {
  /** Worker pid — exit when registry ownership moves to another worker. */
  workerPid: number;
  port: number;
  /**
   * Grace window after the last CLI disconnects (or at boot with no sessions)
   * before the worker shuts down.
   */
  idleGraceMs?: number;
  onProjectReleased: (projectDir: string) => Promise<void>;
  onShutdown: () => void;
};

export type StudioSessionManager = {
  /** Block until the HTTP client disconnects, then release the session. */
  holdUntilDisconnect: (
    projectDir: string,
    cliPid: number,
    signal: AbortSignal,
  ) => Promise<void>;
  start: () => void;
  stop: () => void;
};

type Session = {
  projectDir: string;
  cliPid: number;
};

export function createStudioSessionManager(
  options: StudioSessionManagerOptions,
): StudioSessionManager {
  const idleGraceMs = options.idleGraceMs ?? 2_000;
  const sessions = new Map<string, Session>();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let registryWatcher: FSWatcher | null = null;
  let stopped = false;
  let shuttingDown = false;

  const sessionKey = (projectDir: string, cliPid: number) =>
    `${projectDir}:${cliPid}`;

  const triggerShutdown = (reason: string) => {
    if (stopped || shuttingDown) return;
    shuttingDown = true;
    stopped = true;
    if (idleTimer) clearTimeout(idleTimer);
    registryWatcher?.close();
    log.info("worker shutdown", { reason, port: options.port });
    options.onShutdown();
  };

  const armIdleTimer = () => {
    if (stopped || sessions.size > 0) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (sessions.size === 0) {
        triggerShutdown("idle");
      }
    }, idleGraceMs);
    idleTimer.unref?.();
  };

  const releaseSession = async (projectDir: string, cliPid: number) => {
    const key = sessionKey(projectDir, cliPid);
    if (!sessions.has(key)) return;

    sessions.delete(key);

    const remainingForProject = countProjectAttachments(
      [...sessions.values()],
      projectDir,
    );
    if (remainingForProject === 0) {
      await options.onProjectReleased(projectDir);
    }

    if (sessions.size === 0) {
      armIdleTimer();
    }
  };

  const checkRegistryOwnership = async () => {
    if (stopped) return;

    let raw: { port?: number; pid?: number } | null = null;
    try {
      raw = JSON.parse(await fs.readFile(REGISTRY_PATH, "utf8"));
    } catch {
      return;
    }

    if (
      typeof raw?.port === "number" &&
      typeof raw?.pid === "number" &&
      raw.port === options.port &&
      raw.pid !== options.workerPid
    ) {
      triggerShutdown("superseded");
    }
  };

  return {
    holdUntilDisconnect: async (projectDir, cliPid, signal) => {
      const key = sessionKey(projectDir, cliPid);

      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }

      sessions.set(key, { projectDir, cliPid });
      log.info("session attached", { projectDir, cliPid });

      await new Promise<void>((resolve) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        signal.addEventListener("abort", () => resolve(), { once: true });
      });

      await releaseSession(projectDir, cliPid);
      log.info("session detached", { projectDir, cliPid });
    },

    start: () => {
      armIdleTimer();

      try {
        registryWatcher = watch(REGISTRY_PATH, () => {
          void checkRegistryOwnership();
        });
        registryWatcher.unref?.();
      } catch {
        // Registry may not exist yet on first boot.
      }
    },

    stop: () => {
      stopped = true;
      if (idleTimer) clearTimeout(idleTimer);
      registryWatcher?.close();
    },
  };
}
