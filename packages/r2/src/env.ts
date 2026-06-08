import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function isMonorepoRoot(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name?: string;
      workspaces?: unknown;
    };
    return pkg.name === "@dddx/monorepo" || pkg.workspaces != null;
  } catch {
    return false;
  }
}

/** Walk up from `startDir` to the repo root (`@dddx/monorepo` or workspaces in package.json). */
export function findMonorepoRoot(startDir = process.cwd()): string | null {
  let dir = startDir;
  while (true) {
    if (isMonorepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function applyEnvFile(path: string): void {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Load `<monorepo-root>/.env` when Bun's cwd-based auto-load misses it
 * (e.g. `cd packages/cli && bun run publish:r2`).
 */
export function loadMonorepoEnv(startDir = process.cwd()): string | null {
  const root = findMonorepoRoot(startDir);
  if (!root) return null;

  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return null;

  applyEnvFile(envPath);
  return envPath;
}
