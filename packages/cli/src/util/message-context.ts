import type { UIMessage } from "ai";

import { isSystemReminderOnlyText } from "@/prompt";

const ATTACHED_PREFIX = /^\[attached /;

/** True when the message includes studio `[attached …]` context parts. */
export function hasAttachedContext(
  parts: UIMessage["parts"] | undefined,
): boolean {
  for (const part of parts ?? []) {
    if (part.type === "text" && typeof part.text === "string") {
      if (ATTACHED_PREFIX.test(part.text.trim())) return true;
    }
  }
  return false;
}

export function hasAttachedContextInMessages(messages: UIMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === "user") {
      return hasAttachedContext(message.parts);
    }
  }
  return false;
}

/** Hide system-reminder-only text parts when loading session history. */
export function hydrateUserMessage(message: UIMessage): UIMessage {
  if (message.role !== "user") return message;

  const out: UIMessage["parts"] = [];

  for (const part of message.parts ?? []) {
    if (part.type === "text" && typeof part.text === "string") {
      if (isSystemReminderOnlyText(part.text)) continue;
    }

    out.push(part);
  }

  return out.length > 0 ? { ...message, parts: out } : message;
}

export function hydrateUserMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => hydrateUserMessage(message));
}
