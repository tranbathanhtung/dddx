import { afterEach, describe, expect, test } from "bun:test";
import { local, origin, production } from "./sdk-origin.ts";

const envKeys = ["NODE_ENV"] as const;

afterEach(() => {
  for (const key of envKeys) delete process.env[key];
});

describe("origin", () => {
  test("uses local apps/web when running from source (DDDX_VERSION unset)", () => {
    process.env.NODE_ENV = "development";
    if (typeof DDDX_VERSION !== "string") {
      expect(origin()).toBe(local);
    }
  });

  test("uses production CDN when built (not local) even if NODE_ENV=development", () => {
    process.env.NODE_ENV = "development";
    if (typeof DDDX_VERSION === "string" && DDDX_VERSION !== "local") {
      expect(origin()).toBe(production);
    }
  });
});
