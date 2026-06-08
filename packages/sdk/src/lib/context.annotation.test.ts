import { describe, expect, test } from "bun:test";

import {
  annotationBody,
  annotationContextName,
  formatAnnotationValue,
  parseAnnotationSourceContext,
} from "./context";

describe("annotation context", () => {
  test("formatAnnotationValue prefixes source metadata", () => {
    const value = formatAnnotationValue(
      "## Page Feedback: /\n**Feedback:** what is this",
      {
        source: "app-preview",
        url: "/",
        device: "desktop",
      },
    );

    expect(value).toStartWith("source: app-preview\nurl: /\ndevice: desktop\n\n");
    expect(parseAnnotationSourceContext(value)).toEqual({
      source: "app-preview",
      url: "/",
      device: "desktop",
    });
    expect(annotationBody(value)).toBe(
      "## Page Feedback: /\n**Feedback:** what is this",
    );
  });

  test("design-canvas annotations include frame path", () => {
    const ctx = {
      source: "design-canvas" as const,
      frame: "today",
      file: "today.html",
      workspace: "demo",
      path: ".dddx/designs/demo/today.html",
      url: "/designs/demo/today.html?v=1",
    };
    expect(annotationContextName(ctx)).toBe("Frame · today");
    expect(formatAnnotationValue("feedback", ctx)).toContain(
      "path: .dddx/designs/demo/today.html",
    );
  });
});
