/**
 * Probes each installed ACP agent, reads session modes + model config from a
 * fresh throwaway session, and writes them into `src/agents/registry.json`.
 *
 * For OpenCode, seeds placeholder API keys in `~/.local/share/opencode/auth.json`
 * for frontier providers that are missing so ACP lists their models (existing
 * providers are left unchanged).
 *
 * Run from repo root: `bun run --cwd packages/cli build:registry-caps`
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpawnAgent } from "spawn-agent";

import {
  builtInAdapter,
  isCommandAvailable,
  type SupportedAgentId,
} from "../src/agents/adapters/index.ts";
import type {
  RegistryCapsModel,
  RegistryCapsMode,
} from "../src/agents/caps.ts";
import { buildStudioCaps } from "../src/agents/caps.ts";
import type { SessionId } from "spawn-agent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(__dirname, "../src/agents/registry.json");

const CONNECT_OPTIONS = {
  cwd: process.cwd(),
  permission: "auto-allow" as const,
  disposeGraceMs: 500,
};

const CLOSE_TIMEOUT_MS = 8_000;

/** Provider IDs in OpenCode auth.json (models.dev / `opencode models` prefixes). */
const OPENCODE_FRONTIER_PROVIDERS = [
  "alibaba", // Qwen
  "deepseek",
  "anthropic", // Claude
  "openai",
  "opencode-go",
  "google",
  "moonshotai",
  "openrouter",
  "github-copilot",
] as const;

const REGISTRY_CAPS_PLACEHOLDER_KEY = "dddx-registry-caps-placeholder";

type OpencodeAuthEntry = { type: "api"; key: string };
type OpencodeAuthFile = Record<string, OpencodeAuthEntry>;

const opencodeAuthPath = () =>
  path.join(os.homedir(), ".local", "share", "opencode", "auth.json");

/** Adds placeholder keys for frontier providers; skips any provider already in auth.json. */
function ensureOpencodeFrontierAuth(): {
  added: string[];
  skipped: string[];
} {
  const authPath = opencodeAuthPath();
  let auth: OpencodeAuthFile = {};

  if (existsSync(authPath)) {
    try {
      auth = JSON.parse(readFileSync(authPath, "utf8")) as OpencodeAuthFile;
    } catch {
      console.warn(`[build:registry-caps] could not parse ${authPath}, starting fresh`);
    }
  }

  const added: string[] = [];
  const skipped: string[] = [];

  for (const provider of OPENCODE_FRONTIER_PROVIDERS) {
    const existing = auth[provider]?.key?.trim();
    if (existing) {
      skipped.push(provider);
      continue;
    }
    auth[provider] = { type: "api", key: REGISTRY_CAPS_PLACEHOLDER_KEY };
    added.push(provider);
  }

  if (added.length > 0) {
    mkdirSync(path.dirname(authPath), { recursive: true });
    writeFileSync(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");
  }

  return { added, skipped };
}

async function closeAgent(agent: SpawnAgent, label: string): Promise<void> {
  try {
    await Promise.race([
      agent.close(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`close timed out after ${CLOSE_TIMEOUT_MS}ms`)),
          CLOSE_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    console.warn(
      `[build:registry-caps] ${label} close:`,
      error instanceof Error ? error.message : error,
    );
  }
}

type RegistryFile = {
  version: string;
  agents: Array<{
    id: string;
    binaries: string[];
    modes: RegistryCapsMode[];
    models: RegistryCapsModel[];
    [key: string]: unknown;
  }>;
  extensions: unknown[];
};

async function refreshAgentCaps(
  entry: RegistryFile["agents"][number],
): Promise<void> {
  const onPath = entry.binaries.some(isCommandAvailable);
  if (!onPath) {
    console.warn(
      `[build:registry-caps] skip ${entry.id}: no binary from binaries[] on PATH`,
    );
    return;
  }

  const adapter = builtInAdapter(entry.id as SupportedAgentId);
  const agent = await SpawnAgent.connect(adapter, CONNECT_OPTIONS);

  let sessionId: SessionId | undefined;
  try {
    sessionId = await agent.createSession({ cwd: process.cwd() });
    const caps = buildStudioCaps(agent, sessionId);
    entry.modes = caps.modes.availableModes.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? null,
    }));
    entry.models = caps.models.availableModels.map((m) => ({
      modelId: m.modelId,
      name: m.name,
      description: m.description ?? null,
    }));
    console.log(
      `[build:registry-caps] ${entry.id}: ${entry.modes.length} mode(s), ${entry.models.length} model(s)`,
    );
  } finally {
    if (
      sessionId &&
      agent.agentCapabilities.sessionCapabilities?.close
    ) {
      await agent.closeSession(sessionId).catch(() => {});
    }
    await closeAgent(agent, entry.id);
  }
}

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryFile;

  const opencodeEntry = raw.agents.find((a) => a.id === "opencode");
  if (opencodeEntry?.binaries.some(isCommandAvailable)) {
    const { added, skipped } = ensureOpencodeFrontierAuth();
    if (added.length > 0) {
      console.log(
        `[build:registry-caps] opencode auth: added placeholder for ${added.join(", ")}`,
      );
    }
    if (skipped.length > 0) {
      console.log(
        `[build:registry-caps] opencode auth: kept existing ${skipped.join(", ")}`,
      );
    }
  }

  await Promise.all(
    raw.agents.map(async (entry) => {
      try {
        await refreshAgentCaps(entry);
      } catch (error) {
        console.warn(
          `[build:registry-caps] ${entry.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );

  writeFileSync(registryPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  console.log(`[build:registry-caps] wrote ${registryPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
