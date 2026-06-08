/**
 * Rewrite package.json for npm publish (bin-only tarball).
 * Restored by scripts/restore-publish.ts after publish.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const pkgPath = join(root, "package.json");
const backupPath = join(root, "package.json.monorepo");

/** Installed next to the global binary — not bundled into bin/dddx. */
const RUNTIME_DEPENDENCIES = {
  "@agentclientprotocol/claude-agent-acp": "^0.41.0",
  "@zed-industries/codex-acp": "^0.15.0",
  "@parcel/watcher": "2.5.1",
} as const;

const OPTIONAL_DEPENDENCIES = {
  "@parcel/watcher-darwin-arm64": "2.5.1",
  "@parcel/watcher-darwin-x64": "2.5.1",
  "@parcel/watcher-linux-arm64-glibc": "2.5.1",
  "@parcel/watcher-linux-x64-glibc": "2.5.1",
  "@parcel/watcher-win32-x64": "2.5.1",
  playwright: "^1.58.2",
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
    repository: source.repository,
    keywords: source.keywords,
    files: ["bin"],
    bin: source.bin,
    dependencies: RUNTIME_DEPENDENCIES,
    optionalDependencies: OPTIONAL_DEPENDENCIES,
  };

  writeFileSync(pkgPath, `${JSON.stringify(publishable, null, 2)}\n`);
  console.log("✓ Prepared package.json for npm publish");
}

if (import.meta.main) {
  preparePublishPackageJson();
}
