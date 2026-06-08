import { afterEach, describe, expect, test } from "bun:test";
import { officialR2PublicBase } from "./plugin-r2.ts";
import { production } from "./sdk-origin.ts";

const envKeys = ["DDDX_PLUGINS_R2_URL", "R2_PUBLIC_BASE_URL"] as const;

afterEach(() => {
  for (const key of envKeys) delete process.env[key];
});

describe("officialR2PublicBase", () => {
  test("defaults to production CDN when env is unset", () => {
    expect(officialR2PublicBase()).toBe(production);
  });
});
