import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
const root = join(import.meta.dir, "..");
const entry = join(root, "src/cli.ts");
const bundle = join(root, "bin/dddx.mjs");
const pkg = (await Bun.file(join(root, "package.json")).json()) as {
  version: string;
};

const channel = process.env.DDDX_CHANNEL?.trim() || "latest";

const defines: Record<string, string> = {
  DDDX_VERSION: pkg.version,
  DDDX_CHANNEL: channel,
};

console.log(`Building dddx ${pkg.version} (${channel})…`);

const externals = [
  "playwright",
  "playwright-core",
  "chromium-bidi",
] as const;

const args = [
  "build",
  entry,
  // ESM bundle — `.mjs` extension required under package.json "type":"module".
  "--target=node",
  `--outfile=${bundle}`,
  "--minify",
  ...externals.flatMap((name) => ["--external", name]),
  ...Object.entries(defines).flatMap(([key, value]) => [
    "--define",
    `${key}=${JSON.stringify(value)}`,
  ]),
];

if (process.env.DDDX_SOURCEMAP === "1") {
  args.push("--sourcemap=linked");
}

const proc = Bun.spawn(["bun", ...args], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});

const code = await proc.exited;
if (code !== 0) process.exit(code);

const bundled = await readFile(bundle, "utf8");
if (!bundled.startsWith("#!")) {
  await writeFile(bundle, `#!/usr/bin/env node\n${bundled}`);
}
await chmod(bundle, 0o755);

// Remove legacy extensionless binary from older builds.
await rm(join(root, "bin/dddx"), { force: true });

console.log(`✓ ${bundle}`);
