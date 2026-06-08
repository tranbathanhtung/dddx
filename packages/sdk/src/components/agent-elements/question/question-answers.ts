import type { UIMessage } from "ai";
import type { QuestionAnswer, QuestionConfig } from "./question-prompt";
import { isQuestionsV2ToolPart } from "./questions-v2";
import { isQuestionToolPartResolved } from "./question-part-status";

export function applyQuestionAnswerToMessages(
  messages: UIMessage[],
  args: {
    toolCallId?: string;
    answers: Array<{ question: QuestionConfig; answer: QuestionAnswer }>;
  },
): UIMessage[] {
  const { toolCallId, answers } = args;
  if (!toolCallId || answers.length === 0) return messages;

  const last = answers[answers.length - 1]!;

  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    let changed = false;
    const parts = (message.parts ?? []).map((part) => {
      if (
        !isQuestionsV2ToolPart(part as { type?: string; toolName?: string })
      ) {
        return part;
      }
      const p = part as {
        toolCallId?: string;
        type?: string;
        toolName?: string;
        input?: unknown;
        output?: unknown;
        state?: string;
      };
      if (p.toolCallId !== toolCallId) return part;
      changed = true;
      return {
        ...p,
        state: "output-available" as const,
        output: {
          answer: last.answer,
          metadata: {
            answers: answers.map(({ question, answer }) => [
              question.title,
              formatAnswerLine(answer),
            ]),
          },
        },
      };
    });
    return changed
      ? { ...message, parts: parts as UIMessage["parts"] }
      : message;
  });
}

/**
 * Marks every unresolved questions-v2 tool part as skipped. Used when the user
 * ignores a pending question and types a free-text message instead — without
 * this the question would dangle in the transcript forever (and a follow-up
 * question would silently stack on top of it).
 */
export function skipUnresolvedQuestionsInMessages(
  messages: UIMessage[],
): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    let changed = false;
    const parts = (message.parts ?? []).map((part) => {
      const candidate = part as {
        type?: string;
        toolName?: string;
        state?: string;
        output?: unknown;
      };
      if (!isQuestionsV2ToolPart(candidate)) return part;
      if (isQuestionToolPartResolved(candidate)) return part;
      changed = true;
      return {
        ...(part as Record<string, unknown>),
        state: "output-available" as const,
        output: {
          answer: { kind: "skip" as const },
          metadata: { answers: [], skipped: true },
        },
      };
    });
    return changed
      ? { ...message, parts: parts as UIMessage["parts"] }
      : message;
  });
}

function formatAnswerLine(answer: QuestionAnswer): string {
  if (answer.kind === "skip") return "skipped";
  if (answer.kind === "text") return answer.text ?? "";
  const ids = answer.selectedIds?.join(", ") ?? "";
  return answer.text ? `${ids} (${answer.text})` : ids;
}
