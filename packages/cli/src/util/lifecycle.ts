/**
 * Central process signal, exit, and fatal-error handling for the CLI.
 *
 * One set of `process.on` listeners dispatches to scoped registrations so
 * dev / worker / CLI do not each attach their own duplicate handlers.
 */

import { Log } from "./log";

const log = Log.create({ service: "lifecycle" });

type FatalKind = "uncaughtException" | "unhandledRejection";

type ScopeHandlers = {
  label: string;
  onSignal?: (signal: NodeJS.Signals) => void | Promise<void>;
  onExit?: () => void;
  onFatal?: (kind: FatalKind, reason: unknown) => void | Promise<void>;
};

export namespace ProcessLifecycle {
  export interface RegisterOptions {
    /** Unique scope id (e.g. `dev`, `studio-worker`). */
    scope: string;
    /** Log prefix; defaults to `scope`. */
    label?: string;
    onSignal?: (signal: NodeJS.Signals) => void | Promise<void>;
    /** Sync only — `process.on("exit")` cannot be async. */
    onExit?: () => void;
    onFatal?: (kind: FatalKind, reason: unknown) => void | Promise<void>;
  }

  export interface Handle {
    scope: string;
    dispose(): void;
  }

  export interface GlobalFatalOptions {
    label?: string;
    /** When true, schedule SIGKILL if `process.exit` is ignored (`bun --hot`). */
    isHot?: boolean;
    exitCode?: number;
    beforeExit?: () => void | Promise<void>;
  }

  export interface ForceExitOptions {
    isHot?: boolean;
    /** SIGKILL fallback when exit is ignored (studio worker, hot CLI). */
    killAfterMs?: number;
  }

  const scopes = new Map<string, ScopeHandlers>();

  let listenersAttached = false;
  let globalFatal: GlobalFatalOptions | null = null;
  let fatalInFlight = false;

  const formatReason = (reason: unknown): string =>
    reason instanceof Error
      ? (reason.stack ?? reason.message)
      : String(reason);

  export function forceExit(
    code: number,
    options: ForceExitOptions = {},
  ): void {
    const { isHot, killAfterMs = isHot ? 2_000 : 0 } = options;

    try {
      process.exit(code);
    } catch {
      // ignore
    }

    if (killAfterMs > 0) {
      setTimeout(() => {
        try {
          process.kill(process.pid, "SIGKILL");
        } catch {
          // already gone
        }
      }, killAfterMs).unref?.();
    }
  }

  function dispatchSignal(signal: NodeJS.Signals): void {
    for (const handlers of scopes.values()) {
      void handlers.onSignal?.(signal);
    }
  }

  function dispatchExit(): void {
    for (const handlers of scopes.values()) {
      try {
        handlers.onExit?.();
      } catch (err) {
        log.warn("exit handler failed", {
          scope: handlers.label,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async function dispatchFatal(kind: FatalKind, reason: unknown): Promise<void> {
    if (fatalInFlight) return;
    fatalInFlight = true;

    const prefix = globalFatal?.label ?? "dddx";
    console.error(
      `[dddx] ${prefix} ${kind} — shutting down:\n${formatReason(reason)}`,
    );

    try {
      await globalFatal?.beforeExit?.();
    } catch {
      // non-fatal
    }

    if (!globalFatal) {
      for (const handlers of scopes.values()) {
        try {
          await handlers.onFatal?.(kind, reason);
        } catch (err) {
          log.warn("fatal handler failed", {
            scope: handlers.label,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return;
    }

    forceExit(globalFatal.exitCode ?? 1, { isHot: globalFatal.isHot });
  }

  function ensureListeners(): void {
    if (listenersAttached) return;
    listenersAttached = true;

    const onSigint = () => dispatchSignal("SIGINT");
    const onSigterm = () => dispatchSignal("SIGTERM");

    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    process.on("exit", dispatchExit);
    process.on("uncaughtException", (err) => {
      void dispatchFatal("uncaughtException", err);
    });
    process.on("unhandledRejection", (reason) => {
      void dispatchFatal("unhandledRejection", reason);
    });
  }

  /**
   * Scoped handlers (dev session, studio worker). Call `dispose()` when the
   * scope ends (dev teardown, hot reload) so signals route elsewhere.
   */
  export function register(options: RegisterOptions): Handle {
    ensureListeners();

    const handlers: ScopeHandlers = {
      label: options.label ?? options.scope,
      onSignal: options.onSignal,
      onExit: options.onExit,
      onFatal: options.onFatal,
    };

    scopes.set(options.scope, handlers);

    return {
      scope: options.scope,
      dispose() {
        scopes.delete(options.scope);
      },
    };
  }

  const GLOBAL_FATAL_KEY = "__dddx_process_lifecycle_global_fatal__";

  /**
   * Process-wide fatal recovery (CLI under `bun --hot`). Installed once per
   * process; takes precedence over per-scope `onFatal` handlers.
   */
  export function installGlobalFatal(options: GlobalFatalOptions): void {
    const store = globalThis as Record<string, unknown>;
    if (store[GLOBAL_FATAL_KEY]) return;
    store[GLOBAL_FATAL_KEY] = true;

    ensureListeners();
    globalFatal = options;
  }
}
