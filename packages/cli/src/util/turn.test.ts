import { describe, expect, test } from "bun:test";

import { Turn } from "./turn";

describe("Turn.writeTarget", () => {
  test("creates a design workspace when mode is design", async () => {
    const target = await Turn.writeTarget({
      root: "/tmp/project",
      mode: "design",
      requestedWorkspace: null,
      sessionId: "abc12345",
    });

    expect(target?.id).toBeTruthy();
    expect(target?.path).toContain(".dddx/designs");
  });

  test("returns null in agent mode without an explicit workspace", async () => {
    const target = await Turn.writeTarget({
      root: "/tmp/project",
      mode: "agent",
      requestedWorkspace: null,
      sessionId: "abc12345",
    });

    expect(target).toBeNull();
  });
});
