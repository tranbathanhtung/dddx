import {
  Questions,
  asRecord,
  unwrapToolOutput,
  type QuestionConfig,
  type QuestionOption,
} from "@dddx/cli";
import type { QuestionAnswer } from "./question-prompt";

export { Questions };
export type { QuestionConfig, QuestionOption };

/** @deprecated Prefer `Questions.isPending` */
export const isQuestionsV2OutputPending = Questions.isPending;

export function isQuestionsV2ToolPart(part: {
  type?: string;
  toolName?: string;
}): boolean {
  if (part.type === "tool-Question") return true;
  if (part.type === "dynamic-tool" && Questions.isTool(part.toolName ?? "")) {
    return true;
  }
  if (
    typeof part.type === "string" &&
    part.type.startsWith("tool-mcp__") &&
    part.type.includes("questions_v2")
  ) {
    return true;
  }
  return false;
}

/** Parse tool `input` whether it is an object, JSON string, or partial stream. */
export function parseQuestionToolInput(input: unknown): QuestionConfig[] {
  if (input === undefined || input === null) return [];
  if (typeof input === "string") {
    return Questions.normalize(Questions.parse(input));
  }
  return Questions.normalize(input);
}

export function toQuestionToolPart(part: {
  type?: string;
  toolCallId?: string;
  state?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
}): {
  type: "tool-Question";
  toolCallId?: string;
  state?: string;
  input?: { questions: QuestionConfig[]; submitLabel?: string };
  output?: { answer?: QuestionAnswer; metadata?: { answers?: unknown[] } };
} {
  const questions = parseQuestionToolInput(part.input);
  const outputRec = asRecord(unwrapToolOutput(part.output));
  return {
    type: "tool-Question",
    toolCallId: part.toolCallId,
    state: part.state,
    input: {
      questions,
      submitLabel: "Continue",
    },
    output: outputRec
      ? {
          ...(outputRec.answer !== undefined
            ? { answer: outputRec.answer as QuestionAnswer }
            : {}),
          ...(outputRec.metadata !== undefined
            ? { metadata: outputRec.metadata as { answers?: unknown[] } }
            : {}),
        }
      : undefined,
  };
}
