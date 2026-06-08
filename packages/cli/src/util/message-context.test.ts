import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import {
  hasAttachedContext,
  hasAttachedContextInMessages,
} from "./message-context";

describe("hasAttachedContext", () => {
  test("detects attached context text parts", () => {
    expect(
      hasAttachedContext([
        { type: "text", text: "hello" },
        { type: "text", text: "[attached frame]\npath: today.html" },
      ]),
    ).toBe(true);
  });

  test("returns false for plain user text", () => {
    expect(hasAttachedContext([{ type: "text", text: "fix the nav" }])).toBe(
      false,
    );
  });
});

describe("hasAttachedContextInMessages", () => {
  test("checks only the latest user message", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "[attached frame]\nold" }],
      },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "ok" }] },
      {
        id: "3",
        role: "user",
        parts: [{ type: "text", text: "follow up only" }],
      },
    ];
    expect(hasAttachedContextInMessages(messages)).toBe(false);
  });
});
