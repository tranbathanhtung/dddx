/**
 * Per-part rules for user message display (ACP transcript shape):
 * - text part = only `<system-reminder>…` → hidden
 * - other text parts → shown as-is
 */

import { contextKind, type PromptContextPart } from "@/lib/context";

export function formatAttachedLine(part: PromptContextPart): string {
  const kind = contextKind(part);
  if (kind === "annotation") {
    return `[attached annotation]\n${part.value}`;
  }
  return `[attached ${kind}]\n${part.value.trim()}`;
}

export function isSystemReminderOnlyPart(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (!/<system-reminder>/i.test(trimmed)) return false;
  return stripStudioInjectionsFromText(trimmed).length === 0;
}

export function stripStudioInjectionsFromText(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/^\s*\d+→/gm, "")
    .trim();
}
