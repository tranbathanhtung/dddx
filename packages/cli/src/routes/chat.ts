import z from "zod";
import { router, procedure } from "@/trpc";
import { DEFAULT_AGENT_ID } from "../agents";
import { err } from "./errors";
import type { Hono } from "hono";
import { projectDirFromRequest } from "@/util/project-dir";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { type SessionId } from "spawn-agent";
import type { AgentManager } from "@/agents/manager";
import { createTextAndReasoningOnlyStreamTransform } from "@/agents/convert-messages";
import { Log } from "@/util/log";
import { MAIN_FOLDER_ID } from "@/util/workspace";
import { FileWatcher } from "@/util/filewatcher";
import {
  hasAttachedContextInMessages,
  hydrateUserMessages,
} from "@/util/message-context";
import { Turn, type Mode } from "@/util/turn";

const log = Log.create({ name: "chat" });

export const chat = router({
  list: procedure
    .input(
      z.object({
        agent: z.string().optional(),
        /** Required — hydrate transcript only for an explicit session. */
        id: z.string().min(1),
        /** Workspace id (`main` or a prototype under `.dddx/designs`). */
        workspace: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Sessions are always anchored at the project root; the workspace is
        // only a focus hint at send time. Hydrating transcripts therefore
        // ignores `input.workspace` and reads from root.
        const cwd = ctx.dir;
        const agent = input.agent ?? DEFAULT_AGENT_ID;
        const sid = input.id.trim();

        const runtime = await ctx.agentManager.acquire({
          id: agent,
          cwd,
        });

        // loadSessionStreaming (inside listMessages) calls loadSession and replays
        // any buffered session updates — a prior loadSession would duplicate events.
        const raw = await runtime.session.listMessages({
          sessionId: sid as SessionId,
          cwd,
        });

        const messages = hydrateUserMessages(raw as UIMessage[]);

        return { messages };
      } catch (error) {
        throw err.internal(error);
      }
    }),
});

interface ChatRequestBody {
  /**
   * The new turn(s) to forward to ACP. The promptbar trims this to a
   * single message before sending — ACP keeps its own conversation
   * context, so re-shipping the full UI history every turn is both
   * unnecessary and confusing for the agent. We keep the field as
   * an array purely so future multi-part turns (e.g. tool results
   * emitted client-side) slot in without a wire change.
   */
  messages: UIMessage[];
  /** Registry agent id (e.g. "opencode"). Defaults to `opencode`. */
  agent?: string;
  /**
   * ACP session id the client persisted from a previous response.
   * When present we resume that session via `existingSessionId`.
   */
  id?: string | null;
  /** ACP model id (`provider.languageModel` / `setModel`). */
  model?: string | null;
  /**
   * Studio chat mode:
   *   `agent`  → write to main app
   *   `design` → write to a `.dddx/designs/<slug>` folder (auto-created)
   * When omitted the server falls back to attachment-based heuristics.
   */
  mode?: Mode | null;
  /** Workspace id (`main` or prototype name under `.dddx/designs`). */
  workspace?: string | null;
}

export const send = (app: Hono, agentManager: AgentManager) => {
  app.post("/api/chat", async (c) => {
    const dir = projectDirFromRequest(c);
    if (!dir) {
      return c.json({ error: "Missing x-dddx-project header" }, 400);
    }

    const body = (await c.req.json()) as ChatRequestBody;
    const {
      messages,
      agent = DEFAULT_AGENT_ID,
      id,
      model,
      mode,
      workspace,
    } = body;

    log.info({ messages, mode });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let releaseFileWatch: (() => Promise<void>) | undefined;
        try {
          const cwd = dir;

          const turnMode = Turn.normalizeMode(mode);

          const runtime = await agentManager.acquire({
            id: agent,
            cwd,
          });

          const trimmedClientId = typeof id === "string" ? id.trim() : "";
          const sessionId = await runtime.resolveChatSessionForSend(cwd, id);
          log.info("Resolving chat session id", { sessionId });

          const isNewSession = sessionId !== trimmedClientId;
          if (isNewSession) {
            writer.write({
              type: "data-session",
              data: { agent, id: sessionId },
            });
          }

          const writeTarget = await Turn.writeTarget({
            root: cwd,
            mode: turnMode,
            requestedWorkspace: workspace,
            sessionId,
          });

          if (writeTarget && mode === "design") {
            writer.write({
              type: "data-design-active",
              data: { workspaceId: writeTarget.id },
            });

            releaseFileWatch = await FileWatcher.acquire(
              dir,
              writeTarget.path,
              writeTarget.id,
            );
          }

          const modelId =
            typeof model === "string" && model.trim().length > 0
              ? model.trim()
              : undefined;

          const promises = [];

          if (modelId) {
            promises.push(runtime.provider.setModel(sessionId, modelId));
          }

          await Promise.all(promises);

          const isDesignMode = turnMode === "design";

          const enriched = Turn.prepend(
            messages,
            Turn.reminder({
              isDesignMode,
              writeTarget,
              includeSystemPrompt: isNewSession,
              includeDesignGuide: Boolean(isDesignMode && writeTarget),
              includeAttachedScope: hasAttachedContextInMessages(messages),
            }),
          );

          const result = await streamText({
            model: runtime.ensureChatLanguageModel(sessionId),
            messages: await convertToModelMessages(enriched),
            experimental_transform: [
              createTextAndReasoningOnlyStreamTransform(),
            ],
            onFinish: async () => {
              await releaseFileWatch?.();
            },
          });

          writer.merge(result.toUIMessageStream());
        } catch (error) {
          await releaseFileWatch?.();
          writer.write({
            type: "error",
            errorText: error instanceof Error ? error.message : String(error),
          });
        }
      },
      onError(error) {
        return error instanceof Error ? error.message : String(error);
      },
    });

    return createUIMessageStreamResponse({ stream });
  });
};
