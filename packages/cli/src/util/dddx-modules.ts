import { existsSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PROBE_PACKAGE = "@parcel/watcher/package.json";

function installRootFromScript(): string | null {
  const script = process.argv[1];
  if (!script) return null;

  try {
    const real = realpathSync(script);
    const binDir = path.dirname(real);
    if (path.basename(binDir) === "bin") {
      return path.dirname(binDir);
    }
  } catch {
    return null;
  }

  return null;
}

function nodeModulesHasPackages(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((entry) => !entry.startsWith("."));
  } catch {
    return false;
  }
}

/** Package / curl install root (`~/.dddx` or `…/node_modules/@dddx/cli`). */
export function dddxInstallRoot(): string | null {
  // Prefer the running binary's package root so npm/bun global installs are not
  // shadowed by DDDX_HOME or an empty ~/.dddx/node_modules from a curl install.
  const fromScript = installRootFromScript();
  if (fromScript) return fromScript;

  const fromEnv = process.env.DDDX_HOME?.trim();
  if (fromEnv) return fromEnv;

  return null;
}

/** Dependency roots for curl installs, package installs, and hoisted globals. */
export function vendoredNodeModulesDirs(): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();

  const add = (dir: string) => {
    const normalized = path.normalize(dir);
    if (seen.has(normalized) || !nodeModulesHasPackages(dir)) return;
    seen.add(normalized);
    dirs.push(normalized);
  };

  const root = dddxInstallRoot();
  if (root) {
    add(path.join(root, "node_modules"));
  }

  const script = process.argv[1];
  if (script) {
    try {
      let dir = path.dirname(realpathSync(script));
      for (let depth = 0; depth < 10; depth++) {
        add(path.join(dir, "node_modules"));
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {
      // ignore
    }
  }

  return dirs;
}

export function createVendoredRequire(): NodeRequire | null {
  for (const modulesDir of vendoredNodeModulesDirs()) {
    const require = createRequire(path.join(modulesDir, ".dddx-resolve.cjs"));
    try {
      require.resolve(PROBE_PACKAGE);
      return require;
    } catch {
      continue;
    }
  }
  return null;
}
