import { describe, expect, test } from "bun:test";

import {
  addAttachment,
  countProjectAttachments,
  hasAttachment,
  liveAttachments,
  removeAttachment,
  type StudioRegistry,
} from "./attachments";

describe("studio attachments", () => {
  const base: StudioRegistry = {
    port: 4723,
    pid: 100,
    attachments: [],
  };

  test("tracks multiple projects and duplicate project sessions", () => {
    let registry = addAttachment(base, "/tmp/a", 11);
    registry = addAttachment(registry, "/tmp/b", 22);
    registry = addAttachment(registry, "/tmp/a", 33);

    expect(registry.attachments).toEqual([
      { projectDir: "/tmp/a", cliPid: 11 },
      { projectDir: "/tmp/b", cliPid: 22 },
      { projectDir: "/tmp/a", cliPid: 33 },
    ]);
    expect(hasAttachment(registry, "/tmp/a", 11)).toBe(true);
    expect(hasAttachment(registry, "/tmp/a", 99)).toBe(false);
  });

  test("does not double-register the same cli pid for a project", () => {
    const once = addAttachment(base, "/tmp/a", 11);
    const twice = addAttachment(once, "/tmp/a", 11);
    expect(twice.attachments).toHaveLength(1);
  });

  test("removes only the matching attachment", () => {
    let registry = addAttachment(base, "/tmp/a", 11);
    registry = addAttachment(registry, "/tmp/a", 22);
    registry = removeAttachment(registry, "/tmp/a", 11);

    expect(registry.attachments).toEqual([{ projectDir: "/tmp/a", cliPid: 22 }]);
    expect(countProjectAttachments(registry.attachments, "/tmp/a")).toBe(1);
  });

  test("liveAttachments keeps only running pids", () => {
    const registry: StudioRegistry = {
      ...base,
      attachments: [
        { projectDir: "/tmp/a", cliPid: process.pid },
        { projectDir: "/tmp/b", cliPid: 999_999_999 },
      ],
    };

    const live = liveAttachments(registry);
    expect(live).toEqual([{ projectDir: "/tmp/a", cliPid: process.pid }]);
  });
});
