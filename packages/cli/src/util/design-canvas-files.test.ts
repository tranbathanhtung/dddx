import { describe, expect, test } from "bun:test";

import {
  canvasFileKind,
  isCanvasEligiblePath,
} from "./design-canvas-files";

describe("canvasFileKind", () => {
  test("classifies canvas media extensions", () => {
    expect(canvasFileKind("today.html")).toBe("html");
    expect(canvasFileKind("hero.png")).toBe("image");
    expect(canvasFileKind("demo.mp4")).toBe("video");
    expect(canvasFileKind("styles.css")).toBeNull();
  });
});

describe("isCanvasEligiblePath", () => {
  test("allows all paths in main workspace", () => {
    expect(
      isCanvasEligiblePath("partials/header.html", "html", "main"),
    ).toBe(true);
    expect(
      isCanvasEligiblePath("deep/nested/asset.png", "image", "main"),
    ).toBe(true);
  });

  test("html: top-level and one-level index.html in prototype", () => {
    expect(isCanvasEligiblePath("today.html", "html", "prototype")).toBe(true);
    expect(isCanvasEligiblePath("today.mobile.html", "html", "prototype")).toBe(
      true,
    );
    expect(
      isCanvasEligiblePath("crypto-demo/index.html", "html", "prototype"),
    ).toBe(true);
    expect(
      isCanvasEligiblePath(
        "crypto-demo/index.mobile.html",
        "html",
        "prototype",
      ),
    ).toBe(true);
    expect(
      isCanvasEligiblePath(
        "crypto-demo/compositions/scene.html",
        "html",
        "prototype",
      ),
    ).toBe(false);
    expect(
      isCanvasEligiblePath("partials/header.html", "html", "prototype"),
    ).toBe(false);
    expect(
      isCanvasEligiblePath("a/b/index.html", "html", "prototype"),
    ).toBe(false);
  });

  test("image: root only in prototype", () => {
    expect(isCanvasEligiblePath("hero.png", "image", "prototype")).toBe(true);
    expect(
      isCanvasEligiblePath("assets/hero.png", "image", "prototype"),
    ).toBe(false);
  });

  test("video: any nested path in prototype", () => {
    expect(
      isCanvasEligiblePath(
        "crypto-demo/renders/crypto-demo_2026-06-05_17-36-07.mp4",
        "video",
        "prototype",
      ),
    ).toBe(true);
  });
});
