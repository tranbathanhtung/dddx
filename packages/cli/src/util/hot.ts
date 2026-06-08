/**
 * @file hot.ts
 * @overview `bun --hot` reload bridge.
 *
 * Under `bun --hot`, modules are re-evaluated *in the same process* when
 * source files change — `process.exit` and signal handlers do **not** fire,
 * so any long-lived resources (spawned children, HTTP/WS servers, file
 * watchers, …) created on the previous evaluation will leak unless we
 * explicitly tear them down before the new module instance takes over.
 *
 * This module provides a tiny "slot" abstraction:
 *   1. State is pinned on `globalThis` so it survives module re-eval.
 *   2. A defensive sweep runs on every (re-)registration to reap whatever
 *      the previous evaluation left behind without going through dispose
 *      (e.g. crashy reload).
 *   3. `import.meta.hot.dispose` is wired up so the *current* slot value
 *      is cleaned right before the new instance evaluates.
 *
 * @example
 * ```ts
 * const slot = Hot.register<number>({
 *   key: "dddDev",
 *   hot: (import.meta as any).hot,
 *   cleanup: (pid) => killTree(pid, "SIGTERM"),
 * });
 *
 * slot.set(child.pid);
 * // …later, when the child exits cleanly:
 * slot.set(null);
 * ```
 */

import { Log } from "./log";

const log = Log.create({ service: "hot" });

export namespace Hot {
  /** Minimal shape of `import.meta.hot` we rely on. */
  export interface BunHot {
    dispose(cb: () => void): void;
  }

  /** Read/write handle to a hot-reload-persistent value. */
  export interface Slot<T> {
    /** Returns the currently stored value (or `null`). */
    get(): T | null;
    /**
     * Stores a value. Does **not** invoke cleanup on the previous value;
     * if you want that, call `cleanup()` first or pass `null`.
     */
    set(value: T | null): void;
    /** Runs cleanup against the current value (if any) and clears the slot. */
    cleanup(): void | Promise<void>;
  }

  export interface RegisterOptions<T> {
    /**
     * Stable key used as the `globalThis` property name. Must be unique
     * per resource type within the process.
     */
    key: string;
    /**
     * `import.meta.hot` from the calling module. Pass `undefined` when
     * not running under `bun --hot` — the slot still works, just without
     * the dispose hook.
     */
    hot?: BunHot;
    /**
     * Tear-down callback invoked with the slot's current value during
     * the defensive sweep and on `hot.dispose`.
     */
    cleanup: (value: T) => void | Promise<void>;
    /**
     * Human-readable label for log lines. Defaults to `key`.
     */
    label?: string;
  }

  interface GlobalSlot<T> {
    value: T | null;
  }

  const cleanupByKey = new Map<string, (value: unknown) => void | Promise<void>>();

  /**
   * Tear down a hot slot without going through dispose (crashy reload or
   * fatal process error).
   */
  export async function emergencyCleanup(key: string): Promise<void> {
    const store = globalThis as Record<string, unknown>;
    await awaitPendingCleanup(key);

    const slot = store[key] as GlobalSlot<unknown> | undefined;
    const cleanup = cleanupByKey.get(key);
    if (!slot?.value || !cleanup) return;

    const prev = slot.value;
    slot.value = null;
    try {
      await cleanup(prev);
    } catch (err) {
      log.warn("hot reload — emergency cleanup failed", {
        slot: key,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Register a hot-reload-persistent slot. Safe to call repeatedly with
   * the same `key` — subsequent registrations reap the previous value
   * before taking ownership.
   */
  const pendingKey = (key: string) => `__dddx_hot_pending__${key}`;

  /** Wait for any in-flight hot-reload teardown before starting a new dev run. */
  export async function awaitPendingCleanup(key: string): Promise<void> {
    const store = globalThis as Record<string, unknown>;
    const pending = store[pendingKey(key)] as Promise<void> | undefined;
    if (pending) await pending;
  }

  export function register<T>(options: RegisterOptions<T>): Slot<T> {
    const { key, hot, cleanup, label = key } = options;

    cleanupByKey.set(key, (value) => cleanup(value as T));

    const store = globalThis as Record<string, unknown>;
    const slot = (store[key] ??= { value: null }) as GlobalSlot<T>;

    const runCleanup = async (value: T) => {
      try {
        await cleanup(value);
      } catch (err) {
        log.warn("hot reload — cleanup failed", {
          slot: label,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };

    const scheduleCleanup = (value: T) => {
      const previous = store[pendingKey(key)] as Promise<void> | undefined;
      const pending = (previous ?? Promise.resolve()).then(() => runCleanup(value));
      store[pendingKey(key)] = pending;
      void pending.finally(() => {
        if (store[pendingKey(key)] === pending) {
          delete store[pendingKey(key)];
        }
      });
    };

    // Defensive sweep: a prior evaluation may have left a value behind
    // without going through dispose (e.g. crashy reload).
    if (slot.value != null) {
      log.info("hot reload — sweeping previous slot", { slot: label });
      const prev = slot.value;
      slot.value = null;
      scheduleCleanup(prev);
    }

    hot?.dispose(() => {
      if (slot.value == null) return;
      const prev = slot.value;
      slot.value = null;
      scheduleCleanup(prev);
    });

    return {
      get: () => slot.value,
      set: (value) => {
        slot.value = value;
      },
      cleanup: () => {
        if (slot.value == null) return;
        const prev = slot.value;
        slot.value = null;
        return runCleanup(prev);
      },
    };
  }
}
