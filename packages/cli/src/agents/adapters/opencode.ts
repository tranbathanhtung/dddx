import type { AdapterFactoryOptions, AgentAdapter } from "spawn-agent";

const PROVIDER = "opencode";
const BIN_DEFAULT = "opencode";

export const opencode = (options: AdapterFactoryOptions = {}): AgentAdapter => {
  const bin = options.binPath ?? BIN_DEFAULT;
  return {
    id: PROVIDER,
    displayName: "OpenCode",
    checkInstalled: async () => {
      return true;
    },
    checkAuthenticated: async () => {
      return true;
    },
    resolve: async () => {
      return { bin, args: ["acp"], env: options.env ?? {} };
    },
  };
};
