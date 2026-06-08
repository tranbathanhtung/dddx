import path from "path";
import z from "zod";
import { Bus } from "./bus";
import { Log } from "./log";
// @ts-expect-error — parcel wrapper has no published types
import { createWrapper } from "@parcel/watcher/wrapper";
import type ParcelWatcher from "@parcel/watcher";

const log = Log.create({ service: "file.watcher" });

const WATCHER_MODULE_KEY = "__dddxParcelWatcherModule";
const WATCHES_KEY = "__dddxFileWatcherWatches";

function getWatcherModule(): typeof ParcelWatcher {
  const store = globalThis as Record<string, unknown>;
  const cached = store[WATCHER_MODULE_KEY] as
    | typeof ParcelWatcher
    | undefined;
  if (cached) return cached;

  const binding = require(
    `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? "-glibc" : ""}`,
  );
  const module = createWrapper(binding) as typeof ParcelWatcher;
  store[WATCHER_MODULE_KEY] = module;
  return module;
}

function getWatches() {
  const store = globalThis as Record<string, unknown>;
  if (!store[WATCHES_KEY]) {
    store[WATCHES_KEY] = new Map<string, WatchEntry>();
  }
  return store[WATCHES_KEY] as Map<string, WatchEntry>;
}

type WatcherBackend = "windows" | "fs-events" | "inotify";

function backend(): WatcherBackend | undefined {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "fs-events";
  if (process.platform === "linux") return "inotify";
  return undefined;
}

type WatchEntry = {
  refCount: number;
  workspaceId: string;
  watchPath: string;
  unsubscribe: () => Promise<void>;
};

const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/.next/**",
  "**/build/**",
];

function watchKey(directory: string, watchPath: string) {
  return `${directory}\0${watchPath}`;
}

export namespace FileWatcher {
  export const FileUpdated = Bus.define(
    "file.watcher.updated",
    z.object({
      workspace: z.string(),
      path: z.string(),
      event: z.union([
        z.literal("add"),
        z.literal("change"),
        z.literal("unlink"),
      ]),
    }),
  );

  export const WatchEnded = Bus.define(
    "file.watcher.ended",
    z.object({
      workspace: z.string(),
    }),
  );

  /**
   * Start (or bump refcount for) a workspace-scoped file watch rooted at
   * `watchPath`. Returns a release function — call when the owning chat
   * stream finishes.
   */
  export async function acquire(
    directory: string,
    watchPath: string,
    workspaceId: string,
  ): Promise<() => Promise<void>> {
    const watches = getWatches();
    const key = watchKey(directory, watchPath);
    const existing = watches.get(key);
    if (existing) {
      existing.refCount += 1;
      log.info("watch acquire (ref)", { workspaceId, refCount: existing.refCount });
      return () => release(directory, watchPath, workspaceId);
    }

    const resolved = path.resolve(watchPath);
    const platBackend = backend();
    if (!platBackend) {
      log.error("watcher backend not supported", { platform: process.platform });
      return async () => {};
    }

    log.info("watch start", { directory, workspaceId, watchPath: resolved });

    const subscribe: ParcelWatcher.SubscribeCallback = (err, evts) => {
      if (err) {
        log.error("watch error", { error: String(err) });
        return;
      }
      for (const evt of evts) {
        const abs = path.resolve(evt.path);
        if (!abs.startsWith(resolved + path.sep) && abs !== resolved) continue;

        const rel = path.relative(resolved, abs).split(path.sep).join("/");
        const event =
          evt.type === "create"
            ? ("add" as const)
            : evt.type === "update"
              ? ("change" as const)
              : evt.type === "delete"
                ? ("unlink" as const)
                : null;
        if (!event) continue;

        void Bus.publishForWorkspace(directory, workspaceId, FileUpdated, {
          workspace: workspaceId,
          path: rel,
          event,
        });
      }
    };

    const sub = await getWatcherModule().subscribe(resolved, subscribe, {
      ignore: IGNORE,
      backend: platBackend,
    });

    watches.set(key, {
      refCount: 1,
      workspaceId,
      watchPath: resolved,
      unsubscribe: () => sub.unsubscribe(),
    });

    return () => release(directory, watchPath, workspaceId);
  }

  async function release(
    directory: string,
    watchPath: string,
    workspaceId: string,
  ): Promise<void> {
    const watches = getWatches();
    const key = watchKey(directory, watchPath);
    const entry = watches.get(key);
    if (!entry) return;

    entry.refCount -= 1;
    log.info("watch release", { workspaceId, refCount: entry.refCount });

    if (entry.refCount > 0) return;

    watches.delete(key);
    await entry.unsubscribe();
    await Bus.publishForWorkspace(directory, workspaceId, WatchEnded, {
      workspace: workspaceId,
    });
    log.info("watch stopped", { workspaceId });
  }

  /** Tear down every active watch (studio server shutdown). */
  export async function disposeAll(): Promise<void> {
    const watches = getWatches();
    const entries = [...watches.entries()];
    watches.clear();
    await Promise.all(
      entries.map(async ([, entry]) => {
        await entry.unsubscribe();
      }),
    );
  }
}
