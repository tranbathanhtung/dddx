import type { AdapterFactoryOptions, AgentAdapter } from "spawn-agent";
import { resolvePackageEntry } from "../resolve-package";

const PROVIDER = "claude";
const SHIM_PACKAGE = "@agentclientprotocol/claude-agent-acp";
const SHIM_ENTRY = "dist/index.js";

export const claude = (options: AdapterFactoryOptions = {}): AgentAdapter => ({
  id: PROVIDER,
  displayName: "Claude Code",
  checkInstalled: async () => {
    return true;
  },
  checkAuthenticated: async () => {
    return true;
  },
  resolve: async () => {
    if (options.binPath) {
      return { bin: options.binPath, args: [], env: options.env ?? {} };
    }

    const shimPath = resolvePackageEntry(SHIM_PACKAGE, SHIM_ENTRY);
    return {
      bin: process.execPath,
      args: [shimPath],
      env: options.env ?? {},
    };
  },
});
