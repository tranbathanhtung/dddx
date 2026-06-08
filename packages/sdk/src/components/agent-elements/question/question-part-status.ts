import { asRecord } from "@dddx/cli";
import type { QuestionAnswer, QuestionConfig } from "./question-prompt";
import {
  isQuestionsV2OutputPending,
  isQuestionsV2ToolPart,
} from "./questions-v2";

function formatInlineAnswer(answer: QuestionAnswer): string {
  if (answer.kind === "skip") return "Skipped";
  if (answer.kind === "text") return answer.text || "Answered";
  const ids = answer.selectedIds?.length ? answer.selectedIds.join(", ") : "";
  if (answer.text) return ids ? `${ids} (${answer.text})` : answer.text;
  return ids || "Answered";
}

/** True when the agent has finished the question tool (no UI prompt / input bar). */
export function isQuestionToolPartResolved(part: {
  type?: string;
  toolName?: string;
  state?: string;
  output?: unknown;
}): boolean {
  if (!isQuestionsV2ToolPart(part)) return false;
  if (isQuestionsV2OutputPending(part.output)) return false;
  const out = asRecord(part.output);
  if (out !== undefined && out.answer !== undefined) return true;
  if (
    part.state === "output-available" ||
    part.state === "output-error" ||
    part.state === "output-denied"
  ) {
    return true;
  }
  const meta = asRecord(out?.metadata);
  if (meta !== undefined && Array.isArray(meta.answers) && meta.answers.length > 0) {
    return true;
  }
  if (typeof out?.output === "string" && out.output.trim().length > 0) {
    return true;
  }
  return false;
}

/** Summary line for a completed question tool (agent `output` / `metadata.answers`). */
export function getResolvedQuestionToolSummary(
  part: { output?: unknown; title?: string },
  questions: QuestionConfig[],
): string {
  const out = asRecord(part.output);
  if (out === undefined) return part.title?.trim() || "Answered";

  if (out.answer !== undefined && typeof out.answer === "object" && out.answer !== null) {
    return formatInlineAnswer(out.answer as QuestionAnswer);
  }

  const prose = out.output;
  if (typeof prose === "string" && prose.trim().length > 0) {
    return prose.trim();
  }

  const meta = asRecord(out.metadata);
  const answers = meta?.answers;
  if (Array.isArray(answers) && answers.length > 0) {
    const parts: string[] = [];
    for (let i = 0; i < answers.length; i++) {
      const row = answers[i];
      const labels = Array.isArray(row)
        ? row.map((x) => String(x)).join(", ")
        : String(row ?? "");
      const q = questions[i];
      const head = q?.title ? `${q.title}: ` : `${i + 1}. `;
      parts.push(`${head}${labels}`);
    }
    return parts.join(" • ");
  }

  return part.title?.trim() || "Answered";
}
