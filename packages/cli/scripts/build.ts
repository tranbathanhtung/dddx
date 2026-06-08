import { chmod } from "node:fs/promises";
import { join } from "node:path";
const root = join(import.meta.dir, "..");
const entry = join(root, "src/cli.ts");
const outfile = join(root, "bin/dddx");
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
  // `bin/dddx` shebang is `node`; bun target emits code Node can run directly.
  "--target=node",
  `--outfile=${outfile}`,
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

await chmod(outfile, 0o755);
console.log(`✓ ${outfile}`);
