import { readdirSync, rmSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outDir = join(root, "dist");
const loaderEntry = join(root, "index.ts");
const studioEntry = join(root, "studio.ts");
const devtoolsEntry = join(root, "devtools.ts");
const cssInput = join(root, "src", "styles.css");
const cssOutput = join(outDir, "styles.css");

// ─── Clean dist ───────────────────────────────────────────────────────────────
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// ─── Generate Tailwind CSS (scans src/**/*.{ts,tsx}) ─────────────────────────
console.log("Building Tailwind CSS...");
const tw = Bun.spawn(
  ["bunx", "@tailwindcss/cli", "-i", cssInput, "-o", cssOutput, "--minify"],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
const twExit = await tw.exited;
if (twExit !== 0) {
  console.error("Tailwind CSS build failed");
  process.exit(1);
}
console.log("✓ Tailwind  →  dist/styles.css");

const generatedCSS = await Bun.file(cssOutput).text();

// Plugin: intercept src/styles.css imports and inject CSS into document
const tailwindPlugin: import("bun").BunPlugin = {
  name: "tailwind-inline",
  setup(build) {
    build.onLoad({ filter: /styles\.css$/ }, () => ({
      contents: `
        const css = ${JSON.stringify(generatedCSS)};
        if (typeof document !== "undefined") {
          (window.dddx ??= {}).styles = css;
        }
        export default css;
      `,
      loader: "js",
    }));
  },
};

// Shared config
const sharedConfig = {
  target: "browser" as const,
  minify: true,
  plugins: [tailwindPlugin],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
};

// ─── ESM build (loader + studio + devtools) ───────────────────────────────────
const esm = await Bun.build({
  ...sharedConfig,
  entrypoints: [loaderEntry, studioEntry, devtoolsEntry],
  outdir: outDir,
  format: "esm",
  sourcemap: "none",
  naming: "[name].js",
});

if (!esm.success) {
  console.error("ESM build failed:");
  for (const log of esm.logs) console.error(log);
  process.exit(1);
}

for (const file of readdirSync(outDir)) {
  if (file.endsWith(".map")) unlinkSync(join(outDir, file));
}

console.log("✓ ESM  →  dist/index.js (loader)");
console.log("✓ ESM  →  dist/studio.js (lazy chunk)");
console.log("✓ ESM  →  dist/devtools.js");
console.log("\nBuild complete.");
console.log(
  "Local: apps/web serves /sdk/local/*.js from packages/sdk/dist (run `bun run build` here first).",
);
console.log(
  "Production: bun run publish:r2  (sdk-r2 push; requires R2_* + R2_PUBLIC_BASE_URL).",
);
