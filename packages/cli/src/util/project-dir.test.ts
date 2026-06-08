import { describe, expect, test } from "bun:test";

import { slugFromPath } from "./project-dir";

describe("slugFromPath", () => {
  test("reads slug from studio path", () => {
    expect(slugFromPath("/p/dddx-react-example-f3f9fe")).toBe(
      "dddx-react-example-f3f9fe",
    );
  });

  test("reads slug from nested asset paths", () => {
    expect(
      slugFromPath("/p/dddx-react-example-f3f9fe/designs/ws/index.html"),
    ).toBe("dddx-react-example-f3f9fe");
  });

  test("returns empty when path has no project prefix", () => {
    expect(slugFromPath("/event")).toBe("");
    expect(slugFromPath("/")).toBe("");
  });
});
