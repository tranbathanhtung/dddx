import { describe, expect, test } from "bun:test";

import { createStudioSessionManager } from "./session";
import { resolveStudioPort } from "./registry";

describe("studio session manager", () => {
  test("shuts down after the last attach connection ends", async () => {
    let shutdownReason = "";
    const released: string[] = [];

    const sessions = createStudioSessionManager({
      workerPid: 42,
      port: resolveStudioPort(),
      idleGraceMs: 50,
      onProjectReleased: async (dir) => {
        released.push(dir);
      },
      onShutdown: () => {
        shutdownReason = "idle";
      },
    });

    sessions.start();

    const controller = new AbortController();
    const hold = sessions.holdUntilDisconnect("/tmp/a", 11, controller.signal);

    await new Promise((r) => setTimeout(r, 10));
    expect(shutdownReason).toBe("");

    controller.abort();
    await hold;

    await new Promise((r) => setTimeout(r, 80));
    expect(released).toEqual(["/tmp/a"]);
    expect(shutdownReason).toBe("idle");

    sessions.stop();
  });
});
