import type {
  StreamTextTransform,
  TextStreamPart,
  ToolSet,
  UIMessage,
} from "ai";
import type { AgentEvent } from "spawn-agent";
import { Questions } from "@/mcp/questions";

interface State {
  messages: UIMessage[];
  userParts: UIMessage["parts"];
  userId: string | undefined;
  assistantParts: UIMessage["parts"];
  assistantId: string | undefined;
  nextId: number;
}

const createState = (): State => ({
  messages: [],
  userParts: [],
  userId: undefined,
  assistantParts: [],
  assistantId: undefined,
  nextId: 0,
});

const syntheticId = (state: State, role: UIMessage["role"]): string =>
  `${role}-${state.nextId++}`;

const flushAssistant = (state: State): void => {
  if (state.assistantParts.length === 0) {
    state.assistantId = undefined;
    return;
  }
  state.messages.push({
    id: state.assistantId ?? syntheticId(state, "assistant"),
    role: "assistant",
    parts: state.assistantParts,
  });
  state.assistantParts = [];
  state.assistantId = undefined;
};

const flushUser = (state: State): void => {
  if (state.userParts.length === 0) {
    state.userId = undefined;
    return;
  }
  flushAssistant(state);
  state.messages.push({
    id: state.userId ?? syntheticId(state, "user"),
    role: "user",
    parts: state.userParts,
  });
  state.userParts = [];
  state.userId = undefined;
};

const appendUserChunk = (
  state: State,
  text: string,
  messageId: string | undefined,
): void => {
  state.userId ??= messageId;
  state.userParts.push({ type: "text", text, state: "done" });
};

const appendAssistantDelta = (
  state: State,
  kind: "text" | "reasoning",
  text: string,
  messageId: string | undefined,
): void => {
  flushUser(state);
  state.assistantId ??= messageId;
  const lastPart = state.assistantParts.at(-1);
  if (lastPart !== undefined && lastPart.type === kind) {
    lastPart.text += text;
  } else {
    state.assistantParts.push({ type: kind, text, state: "done" });
  }
};

const applyEvent = (state: State, event: AgentEvent): void => {
  if (event.type === "raw") {
    const update = event.update;
    if (
      update.sessionUpdate === "user_message_chunk" &&
      update.content.type === "text"
    ) {
      appendUserChunk(
        state,
        update.content.text,
        update.messageId ?? undefined,
      );
    }
    return;
  }

  switch (event.type) {
    case "thinking-delta":
      appendAssistantDelta(state, "reasoning", event.text, event.messageId);
      break;
    case "text-delta":
      appendAssistantDelta(state, "text", event.text, event.messageId);
      break;
  }
};

export const agentEventsToUiMessages = (
  events: Iterable<AgentEvent>,
): UIMessage[] => {
  const state = createState();
  for (const event of events) {
    applyEvent(state, event);
  }
  flushUser(state);
  flushAssistant(state);

  return state.messages;
};

const TOOL_STREAM_TYPES = new Set([
  "tool-call",
  "tool-result",
  "tool-error",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-end",
]);

const isQuestionsV2StreamChunk = (chunk: TextStreamPart<ToolSet>): boolean => {
  if (!TOOL_STREAM_TYPES.has(chunk.type)) return false;
  const toolName =
    "toolName" in chunk && typeof chunk.toolName === "string"
      ? chunk.toolName
      : "";
  return Questions.isTool(toolName);
};

/**
 * Drops tool stream chunks so the live chat UI only shows text and reasoning,
 * except `questions_v2` which is rendered as the studio question bar / form.
 */
export function createTextAndReasoningOnlyStreamTransform<
  TOOLS extends ToolSet = ToolSet,
>(): StreamTextTransform<TOOLS> {
  return () =>
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (
          TOOL_STREAM_TYPES.has(chunk.type) &&
          !isQuestionsV2StreamChunk(chunk as TextStreamPart<ToolSet>)
        ) {
          return;
        }
        controller.enqueue(chunk);
      },
    });
}
