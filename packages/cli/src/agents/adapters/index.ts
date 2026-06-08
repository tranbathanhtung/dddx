import { spawnSync } from "node:child_process";
import type { AdapterFactoryOptions, AgentAdapter } from "spawn-agent";
import { cursor } from "./cursor";
import { opencode } from "./opencode";
import { pi } from "./pi";
import registry from "../registry.json";
import { claude } from "./claude";
import { codex } from "./codex";

export const isCommandAvailable = (command: string): boolean => {
  const isWindows = process.platform === "win32";
  const lookup = isWindows ? "where" : "which";
  const result = spawnSync(lookup, [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    shell: false,
  });
  return result.status === 0 && result.stdout.trim().length > 0;
};

export const isAuthenticated = (auth: string): boolean => {
  const [command, ...args] = auth.split(" ");
  const result = spawnSync(command!, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    shell: false,
  });
  return result.status === 0;
};

export const SUPPORTED_AGENT_IDS = registry.agents.map(
  (agent) => agent.id,
) as unknown as readonly [
  "cursor",
  "opencode",
  "pi-acp",
  "claude-acp",
  "codex-acp",
];

export type SupportedAgentId = (typeof SUPPORTED_AGENT_IDS)[number];

export const builtInAdapter = (
  id: SupportedAgentId,
  options?: AdapterFactoryOptions,
): AgentAdapter => {
  switch (id) {
    case "cursor":
      return cursor(options);
    case "opencode":
      return opencode(options);
    case "pi-acp":
      return pi(options);
    case "claude-acp":
      return claude(options);
    case "codex-acp":
      return codex(options);
  }
};
