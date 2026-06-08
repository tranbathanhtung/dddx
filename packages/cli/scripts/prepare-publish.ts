/**
 * Rewrite package.json for npm publish (slim bin + curl-deps manifests).
 * Restored by scripts/restore-publish.ts after publish.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const pkgPath = join(root, "package.json");
const backupPath = join(root, "package.json.monorepo");

/** Shipped in the published tarball — not bundled into bin/dddx.mjs. */
export const RUNTIME_DEPENDENCIES = {
  "@agentclientprotocol/claude-agent-acp": "^0.41.0",
  "@zed-industries/codex-acp": "^0.15.0",
  "@parcel/watcher": "2.5.1",
} as const;

export const OPTIONAL_DEPENDENCIES = {
  "@parcel/watcher-darwin-arm64": "2.5.1",
  "@parcel/watcher-darwin-x64": "2.5.1",
  "@parcel/watcher-linux-arm64-glibc": "2.5.1",
  "@parcel/watcher-linux-x64-glibc": "2.5.1",
  "@parcel/watcher-win32-x64": "2.5.1",
  "@zed-industries/codex-acp-darwin-arm64": "0.15.0",
  "@zed-industries/codex-acp-darwin-x64": "0.15.0",
  "@zed-industries/codex-acp-linux-arm64": "0.15.0",
  "@zed-industries/codex-acp-linux-x64": "0.15.0",
  "@zed-industries/codex-acp-win32-arm64": "0.15.0",
  "@zed-industries/codex-acp-win32-x64": "0.15.0",
} as const;

type PackageJson = {
  name: string;
  version: string;
  repository?: unknown;
  keywords?: string[];
  bin?: Record<string, string>;
};

export function preparePublishPackageJson(): void {
  const source = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;

  if (!existsSync(backupPath)) {
    copyFileSync(pkgPath, backupPath);
  }

  const publishable = {
    name: source.name,
    version: source.version,
    type: "module",
    engines: { node: ">=20.9.0" },
    repository: source.repository,
    keywords: source.keywords,
    files: ["bin", "curl-deps"],
    bin: { dddx: "bin/dddx.mjs" },
    dependencies: RUNTIME_DEPENDENCIES,
    optionalDependencies: OPTIONAL_DEPENDENCIES,
  };

  writeFileSync(pkgPath, `${JSON.stringify(publishable, null, 2)}\n`);
  console.log("✓ Prepared package.json for npm publish");
}

if (import.meta.main) {
  preparePublishPackageJson();
}
