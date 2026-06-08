import { describe, expect, test } from "bun:test";

import { resolveCanvasActiveWorkspace } from "./resolve-canvas-workspace";

describe("resolveCanvasActiveWorkspace", () => {
  test("trusts wanted id while list is loading after agent auto-create", () => {
    expect(
      resolveCanvasActiveWorkspace({
        wanted: "design-abc12345",
        optionIds: [],
        first: undefined,
        listReady: false,
        listFetching: false,
      }),
    ).toBe("design-abc12345");
  });

  test("trusts wanted id while list is refetching", () => {
    expect(
      resolveCanvasActiveWorkspace({
        wanted: "design-abc12345",
        optionIds: [],
        first: undefined,
        listReady: true,
        listFetching: true,
      }),
    ).toBe("design-abc12345");
  });

  test("uses wanted once it appears in the list", () => {
    expect(
      resolveCanvasActiveWorkspace({
        wanted: "design-abc12345",
        optionIds: ["design-abc12345"],
        first: "design-abc12345",
        listReady: true,
        listFetching: false,
      }),
    ).toBe("design-abc12345");
  });

  test("falls back to first prototype when wanted is stale", () => {
    expect(
      resolveCanvasActiveWorkspace({
        wanted: "deleted-ws",
        optionIds: ["biennale-yellow"],
        first: "biennale-yellow",
        listReady: true,
        listFetching: false,
      }),
    ).toBe("biennale-yellow");
  });
});
