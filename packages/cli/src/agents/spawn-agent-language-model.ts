import type {
  JSONObject,
  JSONValue,
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from "@ai-sdk/provider";
import { generateId } from "@ai-sdk/provider-utils";
import type {
  SpawnAgent,
  SessionId,
  SlashCommandInput,
  StopReason,
  UsageReport,
} from "spawn-agent";
import { convertPromptToContentBlocks } from "./convert-prompt";
import { Questions } from "@/mcp/questions";

export const AI_SDK_PROVIDER_NAME = "spawn-agent";
export const AI_SDK_PROVIDER_OPTIONS_KEY = "spawnAgent";

export interface AcquiredSession {
  readonly agent: SpawnAgent;
  readonly sessionId: SessionId;
  readonly isSessionBound: boolean;
  release(): Promise<void>;
}

export interface SpawnAgentLanguageModelConfig {
  readonly modelId: string;
  readonly acquire: (input: {
    systemPrompt: string | undefined;
  }) => Promise<AcquiredSession>;
  readonly provider?: string;
}

interface SpawnAgentProviderOptions {
  readonly command?: SlashCommandInput | string;
}

interface AcpToolInvocationBufferRecord {
  toolName: string;
  latestInput: unknown;
}

const formatToolActivityLabel = (toolName: string, title?: string): string => {
  const label = title?.trim() || toolName.trim() || "tool";
  return `Running ${label}…`;
};

export class SpawnAgentLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  readonly #acquire: SpawnAgentLanguageModelConfig["acquire"];

  constructor(config: SpawnAgentLanguageModelConfig) {
    this.modelId = config.modelId;
    this.provider = config.provider ?? AI_SDK_PROVIDER_NAME;
    this.#acquire = config.acquire;
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const command = parseCommand(providerOptionsFor(options).command);
    const initialConversion = convertPromptToContentBlocks(options.prompt);
    const acquired = await this.#acquire({
      systemPrompt: initialConversion.systemPrompt,
    });
    const conversion = acquired.isSessionBound
      ? convertPromptToContentBlocks(options.prompt, {
          lastUserOnly: true,
          warnOnSystemMessage: true,
        })
      : initialConversion;
    const allWarnings = [
      ...conversion.warnings,
      ...callOptionWarnings(options),
    ];
    try {
      const stream = acquired.agent.prompt(acquired.sessionId, {
        prompt: conversion.blocks,
        ...(command ? { command } : {}),
        ...(options.abortSignal ? { signal: options.abortSignal } : {}),
      });
      const toolCalls: LanguageModelV3Content[] = [];
      const bufferedInvocations = new Map<
        string,
        AcpToolInvocationBufferRecord
      >();
      for await (const event of stream) {
        if (event.type === "tool-call") {
          bufferedInvocations.set(event.toolCallId, {
            toolName: event.tool,
            latestInput: event.input,
          });
        } else if (event.type === "tool-call-update") {
          const row = bufferedInvocations.get(event.toolCallId);
          if (row && event.input !== undefined) {
            row.latestInput = event.input;
          }
          if (event.status === "completed" || event.status === "failed") {
            const resolved = bufferedInvocations.get(event.toolCallId);
            const toolNameForCall = resolved?.toolName ?? event.title ?? "";
            const inputPayload =
              event.input !== undefined ? event.input : resolved?.latestInput;
            toolCalls.push({
              type: "tool-call",
              toolCallId: event.toolCallId,
              toolName: toolNameForCall,
              input: stringifyInput(inputPayload),
              providerExecuted: true,
              dynamic: true,
              ...(event.title !== undefined && event.title.length > 0
                ? { title: event.title }
                : {}),
            });
            bufferedInvocations.delete(event.toolCallId);
          }
        }
      }
      for (const [toolCallId, row] of bufferedInvocations) {
        toolCalls.push({
          type: "tool-call",
          toolCallId,
          toolName: row.toolName,
          input: stringifyInput(row.latestInput),
          providerExecuted: true,
          dynamic: true,
        });
      }
      const result = await stream.completion;
      const content: LanguageModelV3Content[] = [];
      if (result.thinking.length > 0) {
        content.push({ type: "reasoning", text: result.thinking });
      }
      if (result.text.length > 0) {
        content.push({ type: "text", text: result.text });
      }
      content.push(...toolCalls);
      return {
        content,
        finishReason: mapStopReason(result.stopReason),
        usage: mapUsage(result.usage),
        warnings: allWarnings,
        response: { id: result.sessionId },
      };
    } finally {
      await acquired.release();
    }
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3StreamResult> {
    const command = parseCommand(providerOptionsFor(options).command);
    const initialConversion = convertPromptToContentBlocks(options.prompt);
    const optionWarnings = callOptionWarnings(options);
    const abortSignal = options.abortSignal;
    const acquire = this.#acquire;
    const includeRaw = options.includeRawChunks;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        let acquired: AcquiredSession | undefined;
        let textBlockId: string | undefined;
        let reasoningBlockId: string | undefined;
        try {
          acquired = await acquire({
            systemPrompt: initialConversion.systemPrompt,
          });
          const conversion = acquired.isSessionBound
            ? convertPromptToContentBlocks(options.prompt, {
                lastUserOnly: true,
                warnOnSystemMessage: true,
              })
            : initialConversion;
          controller.enqueue({
            type: "stream-start",
            warnings: [...conversion.warnings, ...optionWarnings],
          });
          controller.enqueue({
            type: "response-metadata",
            id: acquired.sessionId,
          });
          const turn = acquired.agent.prompt(acquired.sessionId, {
            prompt: conversion.blocks,
            ...(command ? { command } : {}),
            ...(abortSignal ? { signal: abortSignal } : {}),
          });
          const bufferedInvocations = new Map<
            string,
            AcpToolInvocationBufferRecord
          >();
          /**
           * Close open assistant text/reasoning before tool boundaries so UI parts
           * stay time-ordered (same goal as `agentEventsToUiMessages` in
           * `convert-messages.ts`). Reasoning ends before text to match that
           * pipeline’s flush order.
           *
           * After a close, the next `*-delta` re-opens with `reasoning-start` /
           * `text-start` (including when ACP continues with the same `messageId`
           * after a provider tool).
           */
          const closeOpenAssistantTextAndReasoningIfNeeded = (): void => {
            if (reasoningBlockId !== undefined) {
              controller.enqueue({
                type: "reasoning-end",
                id: reasoningBlockId,
              });
              reasoningBlockId = undefined;
            }
            if (textBlockId !== undefined) {
              controller.enqueue({ type: "text-end", id: textBlockId });
              textBlockId = undefined;
            }
          };
          const openToolActivityReasoning = (
            toolCallId: string,
            label: string,
          ): void => {
            closeOpenAssistantTextAndReasoningIfNeeded();
            reasoningBlockId = `tool-activity-${toolCallId}`;
            controller.enqueue({
              type: "reasoning-start",
              id: reasoningBlockId,
            });
            controller.enqueue({
              type: "reasoning-delta",
              id: reasoningBlockId,
              delta: label,
            });
          };
          for await (const event of turn) {
            switch (event.type) {
              case "text-delta": {
                const incomingTextId = event.messageId ?? textBlockId;
                if (textBlockId === undefined) {
                  textBlockId = incomingTextId ?? generateId();
                  controller.enqueue({ type: "text-start", id: textBlockId });
                } else if (
                  event.messageId !== undefined &&
                  event.messageId !== textBlockId
                ) {
                  controller.enqueue({ type: "text-end", id: textBlockId });
                  textBlockId = event.messageId;
                  controller.enqueue({ type: "text-start", id: textBlockId });
                }
                controller.enqueue({
                  type: "text-delta",
                  id: textBlockId,
                  delta: event.text,
                });
                break;
              }
              case "thinking-delta": {
                const incomingReasonId =
                  event.messageId ?? reasoningBlockId;
                if (reasoningBlockId === undefined) {
                  reasoningBlockId = incomingReasonId ?? generateId();
                  controller.enqueue({
                    type: "reasoning-start",
                    id: reasoningBlockId,
                  });
                } else if (
                  event.messageId !== undefined &&
                  event.messageId !== reasoningBlockId
                ) {
                  controller.enqueue({
                    type: "reasoning-end",
                    id: reasoningBlockId,
                  });
                  reasoningBlockId = event.messageId;
                  controller.enqueue({
                    type: "reasoning-start",
                    id: reasoningBlockId,
                  });
                }
                controller.enqueue({
                  type: "reasoning-delta",
                  id: reasoningBlockId,
                  delta: event.text,
                });
                break;
              }
              case "tool-call": {
                if (!Questions.isTool(event.tool)) {
                  openToolActivityReasoning(
                    event.toolCallId,
                    formatToolActivityLabel(event.tool),
                  );
                }
                bufferedInvocations.set(event.toolCallId, {
                  toolName: event.tool,
                  latestInput: event.input,
                });
                break;
              }
              case "tool-call-update": {
                const row = bufferedInvocations.get(event.toolCallId);
                if (row && event.input !== undefined) {
                  row.latestInput = event.input;
                } else if (!row && event.input !== undefined) {
                  if (!Questions.isTool(event.title ?? "")) {
                    openToolActivityReasoning(
                      event.toolCallId,
                      formatToolActivityLabel(event.title ?? "", event.title),
                    );
                  }
                  bufferedInvocations.set(event.toolCallId, {
                    toolName: event.title ?? "",
                    latestInput: event.input,
                  });
                }
                if (
                  event.status === "completed" &&
                  event.output !== undefined
                ) {
                  const resolved = bufferedInvocations.get(event.toolCallId);
                  const toolNameForCall =
                    resolved?.toolName ?? event.title ?? "";
                  const inputPayload =
                    event.input !== undefined
                      ? event.input
                      : resolved?.latestInput;
                  closeOpenAssistantTextAndReasoningIfNeeded();
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: event.toolCallId,
                    toolName: toolNameForCall,
                    input: stringifyInput(inputPayload),
                    providerExecuted: true,
                    dynamic: true,
                    ...(event.title !== undefined && event.title.length > 0
                      ? { title: event.title }
                      : {}),
                  });
                  controller.enqueue({
                    type: "tool-result",
                    toolCallId: event.toolCallId,
                    toolName: event.title ?? "",
                    result: toJsonResult(event.output),
                    dynamic: true,
                  });
                  bufferedInvocations.delete(event.toolCallId);
                } else if (event.status === "failed") {
                  const resolved = bufferedInvocations.get(event.toolCallId);
                  const toolNameForCall =
                    resolved?.toolName ?? event.title ?? "";
                  const inputPayload =
                    event.input !== undefined
                      ? event.input
                      : resolved?.latestInput;
                  closeOpenAssistantTextAndReasoningIfNeeded();
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: event.toolCallId,
                    toolName: toolNameForCall,
                    input: stringifyInput(inputPayload),
                    providerExecuted: true,
                    dynamic: true,
                    ...(event.title !== undefined && event.title.length > 0
                      ? { title: event.title }
                      : {}),
                  });
                  controller.enqueue({
                    type: "tool-result",
                    toolCallId: event.toolCallId,
                    toolName: event.title ?? "",
                    result: toJsonResult(event.output ?? "tool failed"),
                    isError: true,
                    dynamic: true,
                  });
                  bufferedInvocations.delete(event.toolCallId);
                }
                break;
              }
              default: {
                if (includeRaw) {
                  controller.enqueue({ type: "raw", rawValue: event });
                }
              }
            }
          }
          closeOpenAssistantTextAndReasoningIfNeeded();
          for (const [toolCallId, row] of bufferedInvocations) {
            controller.enqueue({
              type: "tool-call",
              toolCallId,
              toolName: row.toolName,
              input: stringifyInput(row.latestInput),
              providerExecuted: true,
              dynamic: true,
            });
          }
          const result = await turn.completion;
          controller.enqueue({
            type: "finish",
            finishReason: mapStopReason(result.stopReason),
            usage: mapUsage(result.usage),
          });
          controller.close();
        } catch (cause) {
          controller.enqueue({ type: "error", error: cause });
          controller.close();
        } finally {
          if (acquired) await acquired.release();
        }
      },
    });

    return { stream };
  }
}

const providerOptionsFor = (
  options: LanguageModelV3CallOptions,
): SpawnAgentProviderOptions =>
  (options.providerOptions?.[AI_SDK_PROVIDER_OPTIONS_KEY] ??
    {}) as SpawnAgentProviderOptions;

const parseCommand = (
  raw: SlashCommandInput | string | undefined,
): SlashCommandInput | undefined => {
  if (raw === undefined) return undefined;
  if (typeof raw === "string") return { name: raw };
  return raw;
};

const stringifyInput = (input: unknown): string => {
  if (input === undefined || input === null) return "{}";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return "{}";
  }
};

const toJsonResult = (value: unknown): NonNullable<JSONValue> => {
  try {
    const roundTripped = JSON.parse(JSON.stringify(value)) as JSONValue | null;
    if (roundTripped === null) return String(value);
    return roundTripped;
  } catch {
    return String(value);
  }
};

const callOptionWarnings = (
  options: LanguageModelV3CallOptions,
): Array<{ type: "unsupported"; feature: string; details?: string }> => {
  const out: Array<{ type: "unsupported"; feature: string; details?: string }> =
    [];
  if (options.maxOutputTokens !== undefined)
    out.push({ type: "unsupported", feature: "maxOutputTokens" });
  if (options.temperature !== undefined)
    out.push({ type: "unsupported", feature: "temperature" });
  if (options.topP !== undefined)
    out.push({ type: "unsupported", feature: "topP" });
  if (options.topK !== undefined)
    out.push({ type: "unsupported", feature: "topK" });
  if (options.presencePenalty !== undefined)
    out.push({ type: "unsupported", feature: "presencePenalty" });
  if (options.frequencyPenalty !== undefined)
    out.push({ type: "unsupported", feature: "frequencyPenalty" });
  if (options.stopSequences !== undefined && options.stopSequences.length > 0)
    out.push({ type: "unsupported", feature: "stopSequences" });
  if (options.responseFormat?.type === "json")
    out.push({ type: "unsupported", feature: "responseFormat:json" });
  if (options.seed !== undefined)
    out.push({ type: "unsupported", feature: "seed" });
  if (options.tools && options.tools.length > 0)
    out.push({
      type: "unsupported",
      feature: "tools",
      details:
        "ACP agents run tools internally via MCP servers, not via AI SDK tool definitions",
    });
  return out;
};

const mapStopReason = (
  reason: StopReason | undefined,
): LanguageModelV3FinishReason => {
  let unified: LanguageModelV3FinishReason["unified"];
  switch (reason) {
    case "end_turn":
      unified = "stop";
      break;
    case "max_tokens":
      unified = "length";
      break;
    case "max_turn_requests":
      unified = "length";
      break;
    case "refusal":
      unified = "content-filter";
      break;
    case "cancelled":
      unified = "other";
      break;
    default:
      unified = "other";
  }
  return { unified, raw: reason };
};

const mapUsage = (usage: UsageReport | undefined): LanguageModelV3Usage => ({
  inputTokens: {
    total: usage?.used,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: undefined,
    text: undefined,
    reasoning: undefined,
  },
  ...(usage ? { raw: jsonifyUsage(usage) } : {}),
});

const jsonifyUsage = (usage: UsageReport): JSONObject => {
  const out: JSONObject = { size: usage.size, used: usage.used };
  if (usage.cost) {
    try {
      out.cost = JSON.parse(JSON.stringify(usage.cost)) as JSONObject;
    } catch {
      out.cost = null;
    }
  }
  return out;
};
