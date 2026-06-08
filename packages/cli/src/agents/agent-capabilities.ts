import type { AgentCapabilities } from "@agentclientprotocol/sdk";

export type { AgentCapabilities, SessionCapabilities } from "@agentclientprotocol/sdk";

/**
 * Agents whose ACP server advertises session support but is known broken in practice.
 *
 * @see https://forum.cursor.com/t/cursor-acp-session-load-fails-with-session-id-not-found-breaking-persistent-sessions-acpx-openclaw-acp-runtime/155516
 * @see https://agentclientprotocol.com/protocol/initialization#agent-capabilities
 */
export const AGENTS_WITH_BROKEN_ACP_SESSION_PERSISTENCE = new Set<string>([
  "cursor",
]);

const BROKEN_SESSION_NOTICE =
  "This agent's ACP server cannot load or list sessions after refresh. Chat works for this page only.";

/** Per ACP: omitted capabilities are unsupported (default false). */
const ACP_UNSUPPORTED: AgentCapabilities = {
  loadSession: false,
};

/**
 * Studio defaults for registry agents that omit `agentCapabilities` in
 * `registry.json`. Assumes load + list until we probe `initialize` at runtime.
 */
const REGISTRY_AGENT_DEFAULTS: AgentCapabilities = {
  loadSession: true,
  sessionCapabilities: {
    list: {},
    resume: {},
  },
};

function mergeAgentCapabilities(
  base: AgentCapabilities,
  patch?: AgentCapabilities,
): AgentCapabilities {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    mcpCapabilities: patch.mcpCapabilities ?? base.mcpCapabilities,
    promptCapabilities: patch.promptCapabilities ?? base.promptCapabilities,
    sessionCapabilities: {
      ...base.sessionCapabilities,
      ...patch.sessionCapabilities,
    },
  };
}

/**
 * `session/load` — top-level {@link AgentCapabilities.loadSession}.
 * @see https://agentclientprotocol.com/protocol/initialization#agent-capabilities
 */
export function supportsLoadSession(caps: AgentCapabilities): boolean {
  return caps.loadSession === true;
}

/**
 * `session/list` — {@link AgentCapabilities.sessionCapabilities.list}.
 * Supplying `{}` means the method is supported.
 */
export function supportsSessionList(caps: AgentCapabilities): boolean {
  return caps.sessionCapabilities?.list != null;
}

/**
 * `session/resume` — {@link AgentCapabilities.sessionCapabilities.resume}.
 */
export function supportsSessionResume(caps: AgentCapabilities): boolean {
  return caps.sessionCapabilities?.resume != null;
}

/** Safe to store session id in localStorage and hydrate via `session/load`. */
export function supportsPersistedSessions(caps: AgentCapabilities): boolean {
  return supportsLoadSession(caps);
}

/**
 * Apply studio-known fixes on top of declared or default ACP capabilities.
 * Does not mutate the input object.
 */
export function applyKnownAgentCapabilityFixes(
  agentId: string,
  capabilities: AgentCapabilities,
): { agentCapabilities: AgentCapabilities; capabilityNotice?: string } {
  if (!AGENTS_WITH_BROKEN_ACP_SESSION_PERSISTENCE.has(agentId)) {
    return { agentCapabilities: capabilities };
  }

  return {
    agentCapabilities: {
      ...capabilities,
      loadSession: false,
      sessionCapabilities: {
        ...capabilities.sessionCapabilities,
        list: undefined,
        resume: undefined,
      },
    },
    capabilityNotice: BROKEN_SESSION_NOTICE,
  };
}

/**
 * Resolve effective {@link AgentCapabilities} for a registry agent row
 * (static caps before an ACP connection exists).
 */
export function resolveRegistryAgentCapabilities(
  agentId: string,
  declared?: AgentCapabilities,
): { agentCapabilities: AgentCapabilities; capabilityNotice?: string } {
  const merged = declared
    ? mergeAgentCapabilities(REGISTRY_AGENT_DEFAULTS, declared)
    : REGISTRY_AGENT_DEFAULTS;

  return applyKnownAgentCapabilityFixes(agentId, merged);
}

/** Empty capabilities per ACP semantics (all optional features unsupported). */
export function unsupportedAgentCapabilities(): AgentCapabilities {
  return { ...ACP_UNSUPPORTED };
}
