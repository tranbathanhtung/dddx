import { isAuthenticated, isCommandAvailable } from "./adapters";
import registry from "./registry.json";
import { studioCapsFromRegistryModesModels } from "./caps";

export type { RegistryCapsModel, RegistryCapsMode } from "./caps";

/** Row shape from `registry.json` before `available` is joined at runtime. */
export type RegistryAgentBase = (typeof registry.agents)[number];

/** Registry row plus install availability (see {@link getRegistry}). */
export type RegistryAgent = RegistryAgentBase & { available: boolean };

/** Agent the studio defaults to before a user picks one. */
export const DEFAULT_AGENT_ID = "opencode";

export const getRegistry = async (dismissCheck: boolean = false) => {
  if (dismissCheck) {
    return registry;
  }
  const agents = await Promise.all(
    registry.agents.map(async (agent) => {
      const availableCommands = agent.binaries.filter(isCommandAvailable);
      // const authenticated = isAuthenticated(agent.auth);
      return {
        ...agent,
        available: availableCommands.length === agent.binaries.length,
        authenticated: false,
      };
    }),
  );
  return {
    version: registry.version,
    agents,
  };
};
