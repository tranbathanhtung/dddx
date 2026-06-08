import path from "path";

import { Filesystem } from "./filesystem";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

export type CapturePreviewOptions = {
  width?: number;
  height?: number;
  /** Re-capture even when preview.png exists and looks fresh. */
  force?: boolean;
};

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Playwright is required for --capture-previews. Install it with:\n" +
        "  bun add -d playwright --cwd packages/cli\n" +
        "  bunx playwright install chromium",
    );
  }
}

function fileUrl(absPath: string) {
  return `file://${path.resolve(absPath).replace(/\\/g, "/")}`;
}

/** Capture a static thumbnail from a local HTML file or remote preview URL. */
export async function captureHtmlPreview(
  htmlPathOrUrl: string,
  outputPath: string,
  opts: CapturePreviewOptions = {},
) {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const remote = /^https?:\/\//i.test(htmlPathOrUrl.trim());

  if (!opts.force && (await Filesystem.exists(outputPath))) {
    if (!remote) {
      const htmlStat = Filesystem.stat(htmlPathOrUrl);
      const webpStat = Filesystem.stat(outputPath);
      if (
        htmlStat &&
        webpStat &&
        webpStat.mtimeMs >= htmlStat.mtimeMs
      ) {
        return false;
      }
    } else {
      return false;
    }
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const target = remote ? htmlPathOrUrl.trim() : fileUrl(htmlPathOrUrl);
    await page.goto(target, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(300);
    await Filesystem.ensureDir(path.dirname(outputPath));
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false,
    });
    return true;
  } finally {
    await browser.close();
  }
}
