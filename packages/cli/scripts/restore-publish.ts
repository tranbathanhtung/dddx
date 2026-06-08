import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const pkgPath = join(root, "package.json");
const backupPath = join(root, "package.json.monorepo");

export function restorePublishPackageJson(): void {
  if (!existsSync(backupPath)) return;
  copyFileSync(backupPath, pkgPath);
  unlinkSync(backupPath);
  console.log("✓ Restored monorepo package.json");
}

if (import.meta.main) {
  restorePublishPackageJson();
}
