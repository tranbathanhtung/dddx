import path from "path";

export type CanvasFileKind = "html" | "image" | "video";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".ogv",
  ".m4v",
]);

/** One folder deep: `crypto-demo/index.html`, `crypto-demo/index.mobile.html`. */
const NESTED_INDEX_HTML =
  /^[^/]+\/index(?:\.(?:mobile|tablet|desktop))?\.html?$/i;

export function canvasFileKind(filePath: string): CanvasFileKind | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "html";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}

/** Whether a design file should appear as a canvas frame. */
export function isCanvasEligiblePath(
  relPath: string,
  kind: CanvasFileKind,
  workspaceKind: "main" | "prototype",
): boolean {
  if (workspaceKind === "main") return true;

  if (kind === "image") return !relPath.includes("/");
  if (kind === "video") return true;

  if (!relPath.includes("/")) return true;
  return NESTED_INDEX_HTML.test(relPath);
}
