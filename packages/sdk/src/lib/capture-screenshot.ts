import { toPng } from "html-to-image";

export const DEVTOOLS_ROOT_ID = "dddx-devtools-root";

export function markDevtoolsRoot(element: HTMLElement) {
  element.id = DEVTOOLS_ROOT_ID;
}

function shouldExcludeFromScreenshot(node: Node): boolean {
  const devtoolsRoot = document.getElementById(DEVTOOLS_ROOT_ID);
  if (!devtoolsRoot) return false;
  return node === devtoolsRoot || devtoolsRoot.contains(node);
}

/** Capture the visible preview viewport as a PNG data URL. */
export async function captureViewportScreenshot(): Promise<string> {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  return toPng(document.documentElement, {
    width,
    height,
    pixelRatio,
    cacheBust: true,
    filter: (node) => !shouldExcludeFromScreenshot(node),
    style: {
      overflow: "hidden",
      width: `${width}px`,
      height: `${height}px`,
      margin: "0",
      transform: `translate(-${window.scrollX}px, -${window.scrollY}px)`,
      transformOrigin: "top left",
    },
  });
}
