/**
 * @file use-agents.ts
 * @overview React Query hooks around the ACP registry + the persisted
 * agent selection. Centralises:
 *
 *   - `useAgentsRegistry()` – fetches the public registry JSON (with sane
 *     stale + cache windows; the registry barely changes day-to-day).
 *   - `useCurrentAgent()` – joins the persisted `selectedAgentId` with the
 *     fetched registry entry and the agent's local session.
 *     the UI; the CLI server resolves binary installs via `agent-launch`.
 */

import { useCallback, useEffect } from "react";
import { skipToken } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";

import type { AgentCapabilities } from "@dddx/cli";
import type { AppRouter } from "@dddx/cli";
import { supportsPersistedSessions } from "@/lib/agent-capabilities";
import { api } from "@/client";
import {
  useCurrentAgentId,
  useCurrentAgentSetting,
  useStudioStore,
  type AgentSetting,
} from "@/store";

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Inferred from {@link AppRouter} — `agent.caps` nested `caps` field. */
type AgentCapsFromRouter = RouterOutputs["agent"]["caps"]["caps"];

export type { AgentCapabilities };

/** Inferred from {@link AppRouter} — `agent.registry` agent row. */
export type RegistryAgentFromRouter =
  RouterOutputs["agent"]["registry"]["agents"][number] & {
    available: boolean;
  };

/** Fetch + cache the public ACP registry. */
export function useAgentsRegistry() {
  return api.agent.registry.useQuery(undefined, {
    // Registry updates are infrequent; treat the response as fresh for an
    // hour and keep it cached for a day to survive page reloads in dev.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

/** Model/mode lists from static `registry.json` (see `build:registry-caps` in `@dddx/cli`). */
export function useAgentCaps(agent: string) {
  return api.agent.caps.useQuery(agent ? { agent } : skipToken, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export interface UseCurrentAgentResult {
  /** Resolved registry entry; `undefined` while the registry is loading. */
  agent: RegistryAgentFromRouter | undefined;
  /** Persisted active agent id (e.g. "opencode"). */
  id: string;
  /** Persisted prefs for this agent (`id` = last session id). */
  setting: AgentSetting;
  /** Switch to a different agent (auto-selects its mapped session). */
  selectAgent: (agentId: string) => void;
  /** Drop the current agent's session and mint a fresh one. */
  resetSession: () => void;
  /** Persist the ACP session id for the active agent. */
  setSessionId: (id: string | null) => void;
  /** Persist ACP model / mode for the active agent session. */
  setPrefs: (patch: {
    model?: string;
    mode?: "agent" | "design";
    workspace?: string;
  }) => void;
  /** List of available agents. */
  agents: RegistryAgentFromRouter[];
  /**
   * Studio caps from `agent.caps` — modes, models, {@link AgentCapabilities},
   * and optional `capabilityNotice`.
   */
  caps: AgentCapsFromRouter | undefined;
}

/**
 * Convenience hook: everything a UI surface (promptbar, toolbar, ...)
 * needs to render + drive the active agent. Stable across renders
 * thanks to zustand selectors.
 */
export function useCurrentAgent(): UseCurrentAgentResult {
  const id = useCurrentAgentId();
  const selectAgent = useStudioStore((s) => s.agent.select);
  const resetSession = useStudioStore((s) => s.agent.resetSession);
  const setSessionId = useStudioStore((s) => s.agent.setSessionId);
  const setPrefs = useStudioStore((s) => s.agent.setPrefs);
  const setting = useCurrentAgentSetting();

  const registryQuery = useAgentsRegistry();
  const capsQuery = useAgentCaps(id);

  const caps = capsQuery.data?.caps;
  const canPersistSessions = caps?.agentCapabilities
    ? supportsPersistedSessions(caps.agentCapabilities)
    : undefined;
  const agents = (registryQuery.data?.agents ??
    []) as RegistryAgentFromRouter[];
  const agent = agents.find((a) => a.id === id) as RegistryAgentFromRouter;

  /** Drop stale session ids when switching to an agent that cannot persist them. */
  useEffect(() => {
    if (canPersistSessions === false && setting.id) {
      resetSession(id);
    }
  }, [canPersistSessions, setting.id, id]);

  const resetCurrentSession = useCallback(
    () => resetSession(id),
    [id, resetSession],
  );
  const setCurrentSessionId = useCallback(
    (session: string | null) => {
      const acp = caps?.agentCapabilities;
      if (session !== null && acp && !supportsPersistedSessions(acp)) {
        return;
      }
      setSessionId(id, session);
    },
    [id, setSessionId, caps?.agentCapabilities],
  );
  const setCurrentPrefs = useCallback(
    (patch: {
      model?: string;
      mode?: "agent" | "design";
      workspace?: string;
    }) => setPrefs(id, patch),
    [id, setPrefs],
  );

  return {
    agent,
    id,
    setting,
    selectAgent,
    resetSession: resetCurrentSession,
    setSessionId: setCurrentSessionId,
    setPrefs: setCurrentPrefs,
    agents,
    caps,
  };
}
