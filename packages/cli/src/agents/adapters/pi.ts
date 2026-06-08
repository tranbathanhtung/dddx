import type { AdapterFactoryOptions, AgentAdapter } from "spawn-agent";

const PROVIDER = "pi-acp";
const BIN_DEFAULT = "pi-acp";

export const pi = (options: AdapterFactoryOptions = {}): AgentAdapter => {
  const bin = options.binPath ?? BIN_DEFAULT;
  return {
    id: PROVIDER,
    displayName: "Pi",
    checkInstalled: async () => {
      return true;
    },
    resolve: async () => {
      return { bin, args: ["acp"], env: options.env ?? {} };
    },
  };
};
