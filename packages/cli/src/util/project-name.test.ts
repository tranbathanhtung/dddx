import { describe, expect, test } from "bun:test";
import path from "node:path";

import { getProjectSlug, projectSlugLabel } from "./project-name";

describe("getProjectSlug", () => {
  test("derives slug from package.json name", () => {
    const cwd = path.resolve(import.meta.dir, "../../../../examples/react");
    const slug = getProjectSlug(cwd);

    expect(slug.startsWith("dddx-react-example-")).toBe(true);
    expect(slug).toMatch(/-[a-f0-9]{6}$/);
    expect(projectSlugLabel(slug)).toBe("dddx-react-example");
  });

  test("is stable for the same cwd", () => {
    const cwd = path.resolve(import.meta.dir, "../../../../examples/react");
    expect(getProjectSlug(cwd)).toBe(getProjectSlug(cwd));
  });
});
