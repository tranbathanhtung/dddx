import { describe, expect, test } from "bun:test";
import path from "node:path";

import { Installation } from "./installation";

describe("Installation.executablePath", () => {
  test("returns argv[1] instead of the Node runtime path", () => {
    const script = process.argv[1];
    expect(script).toBeTruthy();
    const resolved = Installation.executablePath();
    expect(resolved).not.toBe(process.execPath);
    expect(resolved.endsWith(path.join("installation.test.ts"))).toBe(true);
  });
});

describe("Installation.method", () => {
  test("detects curl install when argv[1] is under ~/.dddx/bin", async () => {
    const originalArgv = process.argv[1];
    process.argv[1] = path.join(
      process.env.HOME ?? "/tmp",
      ".dddx",
      "bin",
      "dddx",
    );
    try {
      expect(await Installation.method()).toBe("curl");
    } finally {
    }
  });
});
