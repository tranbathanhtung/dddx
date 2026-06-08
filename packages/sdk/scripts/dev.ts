import { watch, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outDir = join(root, "dist");
const cssInput = join(root, "src", "styles.css");
const loaderEntry = join(root, "index.ts");
const devtoolsEntry = join(root, "devtools.ts");
const studioEntry = join(root, "studio.ts");
const WEB_PORT = Number(process.env.PORT ?? "3000");
const SDK_ORIGIN = `http://localhost:${WEB_PORT}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[sdk] ${msg}`);
}

// ─── Initial dist dir ─────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });

// ─── Full rebuild: Tailwind CSS → Bun bundle ──────────────────────────────────
async function bundle() {
  const tw = Bun.spawn(
    [
      "bunx",
      "@tailwindcss/cli",
      "-i",
      cssInput,
      "-o",
      join(outDir, "styles.css"),
      "--minify",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  const twExit = await tw.exited;
  if (twExit !== 0) {
    const err = await new Response(tw.stderr).text();
    console.error("[sdk] Tailwind error:", err.trim());
    return;
  }

  const css = await Bun.file(join(outDir, "styles.css"))
    .text()
    .catch(() => "");

  const tailwindPlugin: import("bun").BunPlugin = {
    name: "tailwind-inline",
    setup(build) {
      build.onLoad({ filter: /styles\.css$/ }, () => ({
        contents: `
          const css = ${JSON.stringify(css)};
          if (typeof document !== "undefined") {
            (window.dddx ??= {}).styles = css;
          }
          export default css;
        `,
        loader: "js",
      }));
    },
  };

  const esm = await Bun.build({
    entrypoints: [loaderEntry, studioEntry, devtoolsEntry],
    outdir: outDir,
    target: "browser" as const,
    minify: false,
    plugins: [tailwindPlugin],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    format: "esm",
    sourcemap: "none",
    naming: "[name].js",
  });

  if (!esm.success) {
    for (const l of esm.logs) console.error(l);
    return;
  }

  log("rebuilt → packages/sdk/dist (apps/web route: /sdk/local/*.js)");
}

log("initial bundle...");
await bundle();

let debounce: ReturnType<typeof setTimeout> | null = null;

function scheduleRebuild(filename: string) {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(async () => {
    log(`changed: ${filename} — bundling...`);
    await bundle();
  }, 150);
}

watch(root, { recursive: true }, (_, filename) => {
  if (!filename) return;
  if (
    filename.startsWith("dist/") ||
    filename.startsWith("scripts/") ||
    filename.startsWith("node_modules/")
  )
    return;
  if (/\.(ts|tsx)$/.test(filename)) {
    scheduleRebuild(filename);
  }
});

log(
  `SDK at ${SDK_ORIGIN}/sdk/local/index.js (+ studio.js, devtools.js) via packages/sdk/dist`,
);
log("watching for changes…");
