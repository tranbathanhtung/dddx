import type { AdapterFactoryOptions, AgentAdapter } from "spawn-agent";

const PROVIDER = "cursor";
const BIN_DEFAULT = "agent";

export const cursor = (options: AdapterFactoryOptions = {}): AgentAdapter => {
  const bin = options.binPath ?? BIN_DEFAULT;
  return {
    id: PROVIDER,
    displayName: "Cursor Agent",
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
