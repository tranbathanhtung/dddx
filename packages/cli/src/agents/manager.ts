import {
  AgentUnauthenticatedError,
  AgentUsageLimitError,
  SpawnAgent,
  connect,
  type AgentEvent,
  type LoadSessionInput,
  type SessionId,
  type SpawnAgentConnectOptions,
} from "spawn-agent";
import path from "path";
import { builtInAdapter, type SupportedAgentId } from "./adapters";
import { agentEventsToUiMessages } from "./convert-messages";
import { SpawnAgentLanguageModel } from "./spawn-agent-language-model";
import { Log } from "@/util/log";
import { Mcp } from "@/mcp/mcp";

const studioMcpServers = () => Mcp.servers();

const log = Log.create({ name: "agent-runtime" });

/** Mirrors spawn-agent defaults for stderr-driven fatal errors (not re-exported from the package). */
const AUTH_FAILURE_PATTERNS = [
  "invalid api key",
  "authentication failed",
  "authentication error",
  "unauthorized",
  "invalid_api_key",
] as const;

const USAGE_LIMIT_PATTERNS = [
  "out of usage",
  "limits exceeded",
  "usage exceeded",
] as const;

const matchesAny = (line: string, patterns: readonly string[]): boolean => {
  const lower = line.toLowerCase();
  return patterns.some((p) => lower.includes(p));
};

export type AgentRuntime = {
  agent: SpawnAgent;
  /**
   * Reuses one {@link SpawnAgentLanguageModel} per `sessionId` so chat turns do
   * not allocate a new wrapper each request. Recreated when the bound session changes.
   */
  ensureChatLanguageModel: (sessionId: SessionId) => SpawnAgentLanguageModel;
  /**
   * Mint or resume an ACP session for `/api/chat`. Skips `resumeSession` when this
   * runtime has already wired the same id in-process (spawn-agent keeps it in `#sessions`).
   */
  resolveChatSessionForSend: (
    cwd: string,
    clientSessionId: string | null | undefined,
    options?: { systemPrompt?: string },
  ) => Promise<SessionId>;
  provider: {
    setMode: (sessionId: SessionId, mode: string) => Promise<void>;
    setModel: (sessionId: SessionId, model: string) => Promise<void>;
  };
  session: {
    listMessages: (
      input: LoadSessionInput,
    ) => Promise<ReturnType<typeof agentEventsToUiMessages>>;
  };
  close: () => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Same wire-up as {@link SpawnAgent.connect} (keep in sync when upgrading
 * spawn-agent), plus `connectionResult.closed` so we evict the pool when the
 * child exits. Per-turn `inactivityTimeoutMs` only ends the active stream, not
 * the subprocess; eviction on idle would require an explicit policy here.
 */
const createSpawnAgent = async (
  id: SupportedAgentId,
  options: SpawnAgentConnectOptions,
  onConnectionLost: (runtime: AgentRuntime) => void,
): Promise<AgentRuntime> => {
  const adapter = builtInAdapter(id);
  const {
    dispatcher,
    clientCapabilities,
    clientInfo,
    onFatalError,
    fatalErrorListeners,
    getFirstFatalError,
  } = SpawnAgent.buildDispatcher(options);

  const stderrFatalEnabled = { value: false };
  const authPatterns = options.stderrFatalPatterns?.auth ?? [
    ...AUTH_FAILURE_PATTERNS,
  ];
  const usagePatterns = options.stderrFatalPatterns?.usage ?? [
    ...USAGE_LIMIT_PATTERNS,
  ];

  const connectionResult = await connect(adapter, {
    stderrTailLimit: options.stderrTailLimit,
    extraEnv: options.env,
    ...(options.disposeGraceMs !== undefined
      ? { disposeGraceMs: options.disposeGraceMs }
      : {}),
    ...(options.onTrace ? { onTrace: options.onTrace } : {}),
    ...(options.envFilter ? { envFilter: options.envFilter } : {}),
    onStderr: (line: string) => {
      options.onStderr?.(line);
      if (!stderrFatalEnabled.value) return;
      if (matchesAny(line, authPatterns)) {
        onFatalError(
          new AgentUnauthenticatedError(
            adapter.id,
            `${adapter.displayName} reported authentication failure: ${line}`,
          ),
        );
      } else if (matchesAny(line, usagePatterns)) {
        onFatalError(new AgentUsageLimitError(adapter.id, line));
      }
    },
    client: {
      sessionUpdate: async (notification) =>
        dispatcher.onSessionUpdate(notification),
      requestPermission: async (request) =>
        dispatcher.onPermissionRequest(request),
      ...(dispatcher.onReadTextFile
        ? { readTextFile: dispatcher.onReadTextFile }
        : {}),
      ...(dispatcher.onWriteTextFile
        ? { writeTextFile: dispatcher.onWriteTextFile }
        : {}),
      ...(dispatcher.onCreateTerminal
        ? { createTerminal: dispatcher.onCreateTerminal }
        : {}),
      ...(dispatcher.onTerminalOutput
        ? { terminalOutput: dispatcher.onTerminalOutput }
        : {}),
      ...(dispatcher.onReleaseTerminal
        ? { releaseTerminal: dispatcher.onReleaseTerminal }
        : {}),
      ...(dispatcher.onWaitForTerminalExit
        ? { waitForTerminalExit: dispatcher.onWaitForTerminalExit }
        : {}),
      ...(dispatcher.onKillTerminal
        ? { killTerminal: dispatcher.onKillTerminal }
        : {}),
    },
  });

  let runtimeRef: AgentRuntime | undefined;

  const notifyConnectionLost = () => {
    const r = runtimeRef;
    if (r) onConnectionLost(r);
  };

  void connectionResult.closed.then(notifyConnectionLost);

  const agent = await SpawnAgent.fromConnectResult(connectionResult, {
    options,
    dispatcher,
    clientCapabilities,
    clientInfo,
    fatalErrorListeners,
    getFirstFatalError,
  });

  stderrFatalEnabled.value = true;

  /** Session ids already wired via create/resume on this pooled agent (see `resolveChatSessionForSend`). */
  const chatSessionsWired = new Set<string>();

  const markChatSessionActive = (sessionId: SessionId): void => {
    chatSessionsWired.add(sessionId);
  };

  const resolveChatSessionForSend = async (
    cwd: string,
    clientSessionId: string | null | undefined,
    options?: { systemPrompt?: string },
  ): Promise<SessionId> => {
    const trimmed =
      typeof clientSessionId === "string" ? clientSessionId.trim() : "";
    const sessionSystemPrompt = options?.systemPrompt?.trim() || undefined;

    if (trimmed.length === 0) {
      const sessionId = await agent.createSession({
        cwd,
        ...(sessionSystemPrompt ? { systemPrompt: sessionSystemPrompt } : {}),
        mcpServers: studioMcpServers(),
      });
      markChatSessionActive(sessionId);
      return sessionId;
    }
    if (chatSessionsWired.has(trimmed)) {
      return trimmed as SessionId;
    }
    try {
      await agent.resumeSession({
        sessionId: trimmed as SessionId,
        cwd,
        mcpServers: studioMcpServers(),
      });
      chatSessionsWired.add(trimmed);
      return trimmed as SessionId;
    } catch (error) {
      log.error("Failed to resume session", { error });
      const sessionId = await agent.createSession({
        cwd,
        ...(sessionSystemPrompt ? { systemPrompt: sessionSystemPrompt } : {}),
        mcpServers: studioMcpServers(),
      });
      markChatSessionActive(sessionId);
      return sessionId;
    }
  };

  let chatLanguageModelCache:
    | { sessionId: SessionId; model: SpawnAgentLanguageModel }
    | undefined;

  const ensureChatLanguageModel = (
    sessionId: SessionId,
  ): SpawnAgentLanguageModel => {
    if (chatLanguageModelCache?.sessionId === sessionId) {
      return chatLanguageModelCache.model;
    }
    const model = new SpawnAgentLanguageModel({
      modelId: adapter.id,
      acquire: async () => ({
        agent,
        sessionId,
        isSessionBound: true,
        release: async () => {},
      }),
    });
    chatLanguageModelCache = { sessionId, model };
    return model;
  };

  let userClosed = false;
  const close = async (): Promise<void> => {
    if (userClosed) return;
    userClosed = true;
    chatLanguageModelCache = undefined;
    chatSessionsWired.clear();
    await agent.close();
  };

  const runtime: AgentRuntime = {
    agent,
    ensureChatLanguageModel,
    resolveChatSessionForSend,
    provider: {
      setMode: (sessionId: SessionId, mode: string) =>
        agent.setMode(sessionId, mode),
      setModel: async (sessionId: SessionId, model: string) => {
        await connectionResult.connection.unstable_setSessionModel({
          sessionId,
          modelId: model,
        });
      },
    },
    session: {
      listMessages: async (input: LoadSessionInput) => {
        const handle = agent.loadSessionStreaming(input);
        const events: AgentEvent[] = [];
        const collector = (async () => {
          for await (const event of handle.replay) events.push(event);
        })();
        await handle.completion;
        await collector;
        return agentEventsToUiMessages(events);
      },
    },
    close,
    [Symbol.asyncDispose]: () => close(),
  };

  runtimeRef = runtime;
  fatalErrorListeners.add(notifyConnectionLost);

  return runtime;
};

export class AgentManager {
  private readonly agents = new Map<string, AgentRuntime>();

  private readonly agentInflight = new Map<string, Promise<AgentRuntime>>();

  static tag(id: string, cwd: string) {
    return `${id}:${cwd}`;
  }

  /**
   * Drop the pool entry when the subprocess exits or spawn-agent reports a fatal
   * connection error. Always `close()` the runtime so we do not leak handles if
   * this fires before {@link acquire} has called `Map.set`.
   */
  private evict(tag: string, runtime: AgentRuntime): void {
    if (this.agents.get(tag) === runtime) {
      this.agents.delete(tag);
    }
    void runtime.close().catch(() => {});
  }

  async acquire({
    id,
    cwd,
  }: {
    id: string;
    cwd: string;
  }): Promise<AgentRuntime> {
    const tag = AgentManager.tag(id, cwd);

    const existing = this.agents.get(tag);
    if (existing) {
      return existing;
    }

    const inflight = this.agentInflight.get(tag);
    if (inflight) return inflight;

    const work = (async () => {
      const runtime = await createSpawnAgent(
        id as unknown as SupportedAgentId,
        {
          cwd,
          permission: "auto-allow",
          mcpServers: studioMcpServers(),
        },
        (r) => this.evict(tag, r),
      );
      this.agents.set(tag, runtime);
      return runtime;
    })().finally(() => {
      this.agentInflight.delete(tag);
    });

    this.agentInflight.set(tag, work);

    return work;
  }

  /** Tear down every runtime bound to a single project root. */
  async disposeForDirectory(cwd: string): Promise<void> {
    const target = path.resolve(cwd);
    const closing: Promise<void>[] = [];

    for (const [tag, runtime] of this.agents.entries()) {
      const sep = tag.lastIndexOf(":");
      if (sep === -1) continue;
      if (path.resolve(tag.slice(sep + 1)) !== target) continue;
      this.agents.delete(tag);
      closing.push(runtime.close().catch(() => {}));
    }

    await Promise.all(closing);
  }

  /**
   * Tear down all subprocesses. Map entries are cleared before `close()` so
   * `connectionResult.closed` handlers do not double-close or resurrect stale rows.
   */
  async disposeAll(): Promise<void> {
    const runtimes = [...this.agents.values()];
    this.agents.clear();
    await Promise.all(runtimes.map((r) => r.close().catch(() => {})));
  }
}
