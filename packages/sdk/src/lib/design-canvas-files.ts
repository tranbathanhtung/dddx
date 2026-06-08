export type CanvasMediaKind = "html" | "image" | "video";

export type FramePreset = "desktop" | "tablet" | "mobile";

/** Initial canvas frame size per device preset (the canvas frame *is* the device). */
export const FRAME_PRESETS: Record<
  FramePreset,
  { width: number; height: number }
> = {
  desktop: { width: 1440, height: 1024 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

/**
 * Filename convention for HTML frames: a device suffix before the `.html`
 * extension picks the initial frame size, e.g. `today.mobile.html`,
 * `checkout.tablet.html`, `home.html` (desktop).
 */
const FRAME_SUFFIX = /\.(mobile|tablet|desktop)\.html?$/i;

export function framePresetFromPath(filePath: string): FramePreset {
  const match = filePath.match(FRAME_SUFFIX);
  const preset = match?.[1]?.toLowerCase();
  if (preset === "mobile" || preset === "tablet" || preset === "desktop") {
    return preset;
  }
  return "desktop";
}

export function canvasNodeLabel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const filename = segments.at(-1) ?? normalized;

  const stem = (() => {
    if (FRAME_SUFFIX.test(filename)) {
      return filename.replace(FRAME_SUFFIX, "") || filename;
    }
    return filename.replace(/\.[^./]+$/i, "") || filename;
  })();

  if (stem === "index" && segments.length > 1) {
    return segments.at(-2)!;
  }
  if (/^generated(-\d+)?$/i.test(stem)) return "Generated image";
  return stem;
}

export function defaultCanvasNodeSize(
  kind: CanvasMediaKind,
  filePath?: string,
): {
  width: number;
  height: number;
} {
  if (kind === "html") {
    return FRAME_PRESETS[framePresetFromPath(filePath ?? "")];
  }
  // Placeholder until natural dimensions are measured.
  return { width: 320, height: 240 };
}

export function loadImageNaturalSize(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(new Error("Invalid image dimensions"));
        return;
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export function loadVideoNaturalSize(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        reject(new Error("Invalid video dimensions"));
        return;
      }
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => reject(new Error(`Failed to load video: ${src}`));
    video.src = src;
  });
}

export async function resolveNaturalMediaNodeSize(
  kind: CanvasMediaKind,
  src: string,
): Promise<{ width: number; height: number } | null> {
  if (kind === "html") return null;
  try {
    return kind === "image"
      ? await loadImageNaturalSize(src)
      : await loadVideoNaturalSize(src);
  } catch {
    return null;
  }
}

const PAIRED_ASSET = /\.(css|js|mjs|cjs)$/i;
const HTML_FRAME = /\.html?$/i;

/** `hero-minimal.css` → `hero-minimal.html` (same stem, per-screen pairing). */
export function pairedHtmlPathForAsset(assetPath: string): string | null {
  if (!PAIRED_ASSET.test(assetPath)) return null;
  return assetPath.replace(PAIRED_ASSET, ".html");
}

function framePathMatch(framePaths: string[], candidate: string): string | undefined {
  const lower = candidate.toLowerCase();
  return framePaths.find((p) => p.toLowerCase() === lower);
}

/**
 * Map a watcher path to canvas frame file paths that should show loading.
 * Paired CSS/JS map to their `.html` screen; unpaired assets mark every HTML
 * frame (shared `styles.css`, `deck_stage.js`, etc.).
 */
export function resolveBusyFramePaths(
  changedPath: string,
  framePaths: string[],
): string[] {
  if (!framePaths.length) return [];

  const direct = framePathMatch(framePaths, changedPath);
  if (direct) return [direct];

  const paired = pairedHtmlPathForAsset(changedPath);
  if (paired) {
    const match = framePathMatch(framePaths, paired);
    if (match) return [match];

    const htmlFrames = framePaths.filter((p) => HTML_FRAME.test(p));
    if (htmlFrames.length) return htmlFrames;
  }

  return [];
}
