import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";

import { discoverDevApps } from "./dev-apps";

describe("discoverDevApps (monorepo)", () => {
  test("requires dddx.apps at the workspace root", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "dddx-ws-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        workspaces: { packages: ["apps/*"] },
      }),
    );
    mkdirSync(path.join(root, "apps/web"), { recursive: true });
    writeFileSync(
      path.join(root, "apps/web/package.json"),
      JSON.stringify({
        name: "web",
        scripts: { dev: "next dev" },
      }),
    );

    const result = await discoverDevApps(root, {});

    expect(result).toEqual({
      kind: "needs-config",
      wsRoot: root,
      devPackages: ["apps/web"],
    });
  });

  test("starts all dev packages but only proxies configured apps", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "dddx-ws-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        workspaces: { packages: ["apps/*", "packages/*"] },
        dddx: {
          apps: {
            "apps/web": { port: "3000" },
          },
        },
      }),
    );

    mkdirSync(path.join(root, "apps/web"), { recursive: true });
    writeFileSync(
      path.join(root, "apps/web/package.json"),
      JSON.stringify({
        name: "web",
        scripts: { dev: "next dev" },
      }),
    );

    mkdirSync(path.join(root, "packages/sdk"), { recursive: true });
    writeFileSync(
      path.join(root, "packages/sdk/package.json"),
      JSON.stringify({
        name: "@acme/sdk",
        scripts: { dev: "bun run scripts/dev.ts" },
      }),
    );

    const result = await discoverDevApps(root, {});

    expect(result && "mode" in result ? result.mode : null).toBe("multi");
    if (!result || !("mode" in result)) {
      throw new Error("expected discovery result");
    }

    expect(result.apps.map((app) => app.relPath).sort()).toEqual([
      "apps/web",
      "packages/sdk",
    ]);

    const web = result.apps.find((app) => app.relPath === "apps/web");
    const sdk = result.apps.find((app) => app.relPath === "packages/sdk");

    expect(web?.proxied).toBe(true);
    expect(web?.proxyPort).toBe(3000);
    expect(sdk?.proxied).toBe(false);
    expect(sdk?.proxyPort).toBe(0);
  });

  test("discovers configured monorepo apps from the real workspace", async () => {
    const root = path.resolve(import.meta.dir, "../../../..");
    const result = await discoverDevApps(root, {});

    expect(result && "mode" in result ? result.mode : null).not.toBeNull();
    if (!result || !("mode" in result)) {
      throw new Error("expected discovery result");
    }

    const web = result.apps.find((app) => app.relPath === "apps/web");
    const sdk = result.apps.find((app) => app.relPath === "packages/sdk");

    expect(web?.proxied).toBe(true);
    expect(sdk?.proxied).toBe(false);
  });
});
