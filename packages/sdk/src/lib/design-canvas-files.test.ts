import { describe, expect, test } from "bun:test";

import {
  canvasNodeLabel,
  pairedHtmlPathForAsset,
  resolveBusyFramePaths,
} from "./design-canvas-files";

describe("canvasNodeLabel", () => {
  test("uses filename only, not nested path", () => {
    expect(
      canvasNodeLabel(
        "crypto-demo/renders/crypto-demo_2026-06-05_17-36-07.mp4",
      ),
    ).toBe("crypto-demo_2026-06-05_17-36-07");
  });

  test("nested index.html shows parent folder name", () => {
    expect(canvasNodeLabel("crypto-demo/index.html")).toBe("crypto-demo");
  });

  test("top-level screens keep stem", () => {
    expect(canvasNodeLabel("Deck.html")).toBe("Deck");
    expect(canvasNodeLabel("today.mobile.html")).toBe("today");
  });
});

describe("pairedHtmlPathForAsset", () => {
  test("maps paired css/js to html stem", () => {
    expect(pairedHtmlPathForAsset("hero-minimal.css")).toBe("hero-minimal.html");
    expect(pairedHtmlPathForAsset("hero-minimal.js")).toBe("hero-minimal.html");
    expect(pairedHtmlPathForAsset("today.mobile.css")).toBe("today.mobile.html");
    expect(pairedHtmlPathForAsset("crypto-demo/index.js")).toBe(
      "crypto-demo/index.html",
    );
  });

  test("returns null for non-assets", () => {
    expect(pairedHtmlPathForAsset("hero-minimal.html")).toBeNull();
    expect(pairedHtmlPathForAsset("assets/hero.png")).toBeNull();
  });
});

describe("resolveBusyFramePaths", () => {
  const frames = [
    "hero-minimal.html",
    "hero-dark.html",
    "hero-editorial.html",
    "Deck.html",
  ];

  test("html changes target themselves", () => {
    expect(resolveBusyFramePaths("hero-minimal.html", frames)).toEqual([
      "hero-minimal.html",
    ]);
  });

  test("paired css maps to its html frame", () => {
    expect(resolveBusyFramePaths("hero-minimal.css", frames)).toEqual([
      "hero-minimal.html",
    ]);
  });

  test("unpaired shared assets mark all html frames", () => {
    expect(resolveBusyFramePaths("styles.css", frames)).toEqual([
      "hero-minimal.html",
      "hero-dark.html",
      "hero-editorial.html",
      "Deck.html",
    ]);
    expect(resolveBusyFramePaths("deck_stage.js", frames)).toEqual([
      "hero-minimal.html",
      "hero-dark.html",
      "hero-editorial.html",
      "Deck.html",
    ]);
  });

  test("case-insensitive html match", () => {
    expect(resolveBusyFramePaths("deck.css", frames)).toEqual(["Deck.html"]);
  });
});
