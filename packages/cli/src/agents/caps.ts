import type {
  SessionConfigOption,
  SessionConfigSelectGroup,
  SessionConfigSelectOption,
  SessionConfigSelectOptions,
  SessionModelState,
  SessionModeState,
} from "@agentclientprotocol/sdk";
import type { SpawnAgent, SessionId } from "spawn-agent";
import {
  resolveRegistryAgentCapabilities,
  type AgentCapabilities,
} from "./agent-capabilities";

export type { AgentCapabilities } from "./agent-capabilities";
export {
  AGENTS_WITH_BROKEN_ACP_SESSION_PERSISTENCE,
  applyKnownAgentCapabilityFixes,
  resolveRegistryAgentCapabilities,
  supportsLoadSession,
  supportsPersistedSessions,
  supportsSessionList,
  supportsSessionResume,
} from "./agent-capabilities";

const emptyModes = (): SessionModeState => ({
  availableModes: [],
  currentModeId: "",
});

const emptyModels = (): SessionModelState => ({
  availableModels: [],
  currentModelId: "",
});

type SessionConfigSelectOptionConfig = Extract<
  SessionConfigOption,
  { type: "select" }
>;

const flattenSelectOptions = (
  options: SessionConfigSelectOptions,
): SessionConfigSelectOption[] => {
  if (!Array.isArray(options) || options.length === 0) return [];
  const first = options[0];
  if (first && "value" in first) {
    return options as SessionConfigSelectOption[];
  }
  return (options as SessionConfigSelectGroup[]).flatMap((g) => g.options);
};

const modesFromConfigOption = (
  opt: SessionConfigSelectOptionConfig,
): SessionModeState => ({
  availableModes: flattenSelectOptions(opt.options).map((o) => ({
    id: o.value,
    name: o.name,
    description: o.description,
  })),
  currentModeId: opt.currentValue,
});

const modelsFromConfigOption = (
  opt: SessionConfigSelectOptionConfig,
): SessionModelState => ({
  availableModels: flattenSelectOptions(opt.options).map((o) => ({
    modelId: o.value,
    name: o.name,
    description: o.description,
  })),
  currentModelId: opt.currentValue,
});

/**
 * Shapes advertised by ACP (`modeState`, `configOptions`) into the caps object
 * the studio UI expects (see {@link useAgentCaps} / app-sidebar).
 */
export function buildStudioCaps(
  agent: SpawnAgent,
  sessionId: SessionId,
): { modes: SessionModeState; models: SessionModelState } {
  const opts = agent.configOptionsFor(sessionId) as SessionConfigOption[];

  const modeFromState = agent.modeStateFor(sessionId);
  const modeConfig = opts.find((o) => o.category === "mode");
  const modes =
    modeFromState ??
    (modeConfig?.type === "select"
      ? modesFromConfigOption(modeConfig)
      : emptyModes());

  const modelOpt = opts.find((o) => o.category === "model");
  const models =
    modelOpt?.type === "select"
      ? modelsFromConfigOption(modelOpt)
      : emptyModels();

  return { modes, models };
}

/** Serialized in `registry.json` under each agent (see `build:registry-caps`). */
export type RegistryCapsMode = {
  id: string;
  name: string;
  description?: string | null;
};

export type RegistryCapsModel = {
  modelId: string;
  name: string;
  description?: string | null;
};

/**
 * Builds the same `caps` shape the UI consumes, using only static registry
 * data so users can pick model/mode before a chat session exists.
 */
export function studioCapsFromRegistryModesModels(
  modes: readonly RegistryCapsMode[] | undefined,
  models: readonly RegistryCapsModel[] | undefined,
): { modes: SessionModeState; models: SessionModelState } {
  const m = modes ?? [];
  const mo = models ?? [];
  return {
    modes: {
      availableModes: m.map((x) => ({
        id: x.id,
        name: x.name,
        description: x.description ?? null,
      })),
      currentModeId: m[0]?.id ?? "",
    },
    models: {
      availableModels: mo.map((x) => ({
        modelId: x.modelId,
        name: x.name,
        description: x.description ?? null,
      })),
      currentModelId: mo[0]?.modelId ?? "",
    },
  };
}

export type StudioCaps = ReturnType<typeof studioCapsFromRegistryModesModels> & {
  /** Effective ACP agent capabilities (see initialization handshake). */
  agentCapabilities: AgentCapabilities;
  /** Studio overlay when advertised caps are known broken for this agent. */
  capabilityNotice?: string;
};

/** Static registry row → caps for model/mode pickers + ACP agent capabilities. */
export function studioCapsForRegistryAgent(agent: {
  id: string;
  modes?: readonly RegistryCapsMode[];
  models?: readonly RegistryCapsModel[];
  agentCapabilities?: AgentCapabilities;
}): StudioCaps {
  const { agentCapabilities, capabilityNotice } = resolveRegistryAgentCapabilities(
    agent.id,
    agent.agentCapabilities,
  );

  return {
    ...studioCapsFromRegistryModesModels(agent.modes, agent.models),
    agentCapabilities,
    ...(capabilityNotice ? { capabilityNotice } : {}),
  };
}
