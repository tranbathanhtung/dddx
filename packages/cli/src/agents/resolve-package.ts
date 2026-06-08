import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { AdapterNotFoundError } from "spawn-agent";

import {
  createVendoredRequire,
  vendoredNodeModulesDirs,
} from "../util/dddx-modules";

const fallbackRequire = (): NodeRequire =>
  createRequire(
    typeof __filename !== "undefined" ? __filename : import.meta.url,
  );

const makeRequire = (): NodeRequire =>
  createVendoredRequire() ?? fallbackRequire();

export const resolvePackageDir = (packageName: string): string => {
  const require = makeRequire();
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch (cause) {
    for (const modulesDir of vendoredNodeModulesDirs()) {
      const candidate = path.join(modulesDir, packageName);
      const candidatePackageJson = path.join(candidate, "package.json");
      try {
        const content = JSON.parse(
          fs.readFileSync(candidatePackageJson, "utf-8"),
        );
        if (content.name === packageName) return candidate;
      } catch {
        continue;
      }
    }

    const fallback = fallbackRequire();
    try {
      return path.dirname(fallback.resolve(`${packageName}/package.json`));
    } catch {
      // Fall through to search paths from the primary require.
    }

    const searchPaths = require.resolve.paths(packageName) ?? [];
    for (const searchPath of searchPaths) {
      const candidate = path.join(searchPath, packageName);
      const candidatePackageJson = path.join(candidate, "package.json");
      try {
        const content = JSON.parse(
          fs.readFileSync(candidatePackageJson, "utf-8"),
        );
        if (content.name === packageName) return candidate;
      } catch {
        continue;
      }
    }
    throw new AdapterNotFoundError(packageName, cause);
  }
};

export const resolvePackageBin = (packageName: string): string => {
  const packageDir = resolvePackageDir(packageName);
  const packageJsonPath = path.join(packageDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  if (typeof packageJson.bin === "string") {
    return path.join(packageDir, packageJson.bin);
  }
  if (typeof packageJson.bin === "object" && packageJson.bin !== null) {
    const firstBinPath = Object.values(packageJson.bin)[0];
    if (typeof firstBinPath === "string") {
      return path.join(packageDir, firstBinPath);
    }
  }
  if (typeof packageJson.main === "string") {
    return path.join(packageDir, packageJson.main);
  }
  throw new AdapterNotFoundError(
    packageName,
    new Error("no bin or main entry"),
  );
};

export const resolvePackageEntry = (
  packageName: string,
  subpath: string,
): string => {
  const require = makeRequire();
  try {
    return require.resolve(`${packageName}/${subpath}`);
  } catch (cause) {
    for (const modulesDir of vendoredNodeModulesDirs()) {
      const candidate = path.join(modulesDir, packageName, subpath);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        continue;
      }
    }

    try {
      return fallbackRequire().resolve(`${packageName}/${subpath}`);
    } catch {
      // Fall through.
    }

    throw new AdapterNotFoundError(packageName, cause);
  }
};
