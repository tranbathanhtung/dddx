/**
 * @file trpc.ts
 * @overview Single source for `initTRPC`. Anyone adding new procedures imports
 * `router` / `publicProcedure` from here. Keep this file boring on purpose:
 * cross-cutting concerns (auth, logging, etc.) belong in middleware here, not
 * scattered across procedures.
 */

import { initTRPC } from "@trpc/server";

import type { AgentManager } from "./agents/manager";
import { err } from "./routes/errors";

export interface TRPCContext {
  /** Server-scoped SpawnAgent pool (per agent id + cwd) shared with `/api/chat`. */
  agentManager: AgentManager;
  /** Working directory used when acquiring ACP runtimes. */
  dir: string;
}

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const procedure = t.procedure.use((opts) => {
  if (!opts.ctx.dir) {
    throw err.notFound("Project not found");
  }
  return opts.next();
});
export const middleware = t.middleware;
