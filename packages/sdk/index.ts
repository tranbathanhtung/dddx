import { mountLoading, unmountLoading } from "./src/loading";

// Resolve the studio bundle URL relative to this loader script so that the
// lazy chunk loads from the same origin that served the loader.
function resolveStudio(): string {
  try {
    return new URL("./studio.js", import.meta.url).href;
  } catch {
    return "./studio.js";
  }
}

function waitForLoad(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
      return;
    }
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function injectStyles() {
  const css = window.dddx?.styles;
  if (!css) return;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

export async function startStudio() {
  const dddx = (window.dddx ??= {});
  if (dddx.loaded) return;
  dddx.loaded = true;

  // 1. Show lightweight loading UI immediately (tiny bundle, no React).
  mountLoading();

  // 2. Lazy-load the heavy studio bundle in parallel with `load` event.
  //    The specifier is a runtime variable so the bundler does not inline it.
  const studioUrl = resolveStudio();
  const studioPromise = import(
    /* @vite-ignore */ /* webpackIgnore: true */ studioUrl
  ) as Promise<typeof import("./studio")>;

  try {
    const [studio] = await Promise.all([studioPromise, waitForLoad()]);
    studio.mountStudio();
    injectStyles();
  } catch (err) {
    unmountLoading();
    console.error("[dddx] failed to load studio:", err);
  }
}

// ─── Auto-init when loaded as a plain <script> (UMD/IIFE) ──────────────────────
if (typeof document !== "undefined") {
  startStudio();
}
