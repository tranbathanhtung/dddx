import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const GENERIC_DIR_NAMES = new Set([
  "www",
  "app",
  "src",
  "frontend",
  "backend",
  "client",
  "server",
  "web",
]);

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

function readNameFromPackageJson(cwd: string): string | null {
  const packageJsonPath = join(cwd, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
    };
    return packageJson.name ?? null;
  } catch {
    return null;
  }
}

function readNameFromPyproject(cwd: string): string | null {
  const pyprojectPath = join(cwd, "pyproject.toml");
  if (!existsSync(pyprojectPath)) return null;

  try {
    const content = readFileSync(pyprojectPath, "utf8");
    const match = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function readNameFromSetupPy(cwd: string): string | null {
  const setupPyPath = join(cwd, "setup.py");
  if (!existsSync(setupPyPath)) return null;

  try {
    const content = readFileSync(setupPyPath, "utf8");
    const match = content.match(/name\s*=\s*["']([^"']+)["']/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function readNameFromRails(cwd: string): string | null {
  const railsAppPath = join(cwd, "config", "application.rb");
  if (!existsSync(railsAppPath)) return null;

  try {
    const content = readFileSync(railsAppPath, "utf8");
    const match = content.match(/^\s*module\s+(\w+)/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function fallbackDirName(cwd: string): string {
  const dirName = basename(cwd);
  if (GENERIC_DIR_NAMES.has(dirName.toLowerCase())) {
    return `${basename(dirname(cwd))}-${dirName}`;
  }
  return dirName;
}

/**
 * Stable, URL-safe project slug for a cwd — e.g. `@dddx/react-example` →
 * `dddx-react-example-a1b2c3`. The trailing hash disambiguates duplicate
 * package names in different directories.
 */
export function getProjectSlug(cwd: string): string {
  const resolved = resolve(cwd);

  let projectName =
    readNameFromPackageJson(resolved) ??
    readNameFromPyproject(resolved) ??
    readNameFromSetupPy(resolved) ??
    readNameFromRails(resolved) ??
    fallbackDirName(resolved);

  const pathHash = createHash("sha256")
    .update(resolved)
    .digest("hex")
    .substring(0, 6);

  return `${sanitizeProjectName(projectName)}-${pathHash}`;
}

/** Readable label without the trailing path-hash suffix. */
export function projectSlugLabel(slug: string): string {
  return slug.replace(/-[a-f0-9]{6}$/, "") || slug;
}
