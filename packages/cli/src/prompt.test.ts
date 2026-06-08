import { describe, expect, test } from "bun:test";

import { buildTurnContextBlock, buildTurnReminder } from "./prompt";

const demoTarget = { id: "demo", path: "/proj/.dddx/designs/demo" };

describe("buildTurnContextBlock", () => {
  test("includes plugin_scope when not design and no attachments", () => {
    const block = buildTurnContextBlock({
      isDesignMode: false,
      writeTarget: null,
      includeAttachedScope: false,
    });
    expect(block).toContain("<plugin_scope>");
    expect(block).toContain("No plugin");
    expect(block).not.toContain("<session");
    expect(block).not.toContain("<attached_scope>");
  });

  test("includes session only in design mode", () => {
    const block = buildTurnContextBlock({
      isDesignMode: true,
      writeTarget: demoTarget,
      includeAttachedScope: false,
    });
    expect(block).toContain('<session mode="design"');
    expect(block).toContain('write_root="/proj/.dddx/designs/demo"');
    expect(block).toContain("<plugin_scope>");
    expect(block).not.toContain("<attached_scope>");
  });

  test("omits session in agent mode even when workspace is set", () => {
    const block = buildTurnContextBlock({
      isDesignMode: false,
      writeTarget: demoTarget,
      includeAttachedScope: false,
    });
    expect(block).not.toContain("<session");
    expect(block).toContain("<plugin_scope>");
  });

  test("includes attached_scope without session in agent mode", () => {
    const block = buildTurnContextBlock({
      isDesignMode: false,
      writeTarget: demoTarget,
      includeAttachedScope: true,
    });
    expect(block).not.toContain("<session");
    expect(block).toContain("<plugin_scope>");
    expect(block).toContain("Plugins on **this turn**");
    expect(block).toContain("<attached_scope>");
  });

  test("includes both session and attached_scope in design mode", () => {
    const block = buildTurnContextBlock({
      isDesignMode: true,
      writeTarget: demoTarget,
      includeAttachedScope: true,
    });
    expect(block).toContain("<session");
    expect(block).toContain("<plugin_scope>");
    expect(block).toContain("<attached_scope>");
  });
});

describe("buildTurnReminder", () => {
  test("includes plugin_scope on agent follow-ups without attachments", () => {
    const reminder = buildTurnReminder({
      isDesignMode: false,
      writeTarget: demoTarget,
      includeSystemPrompt: false,
      includeDesignGuide: false,
      includeAttachedScope: false,
    });
    expect(reminder).toContain("<turn_context>");
    expect(reminder).toContain("<plugin_scope>");
    expect(reminder).toContain("No plugin");
  });
});
