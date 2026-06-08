import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { AdapterNotFoundError } from "spawn-agent";

const makeRequire = (): NodeRequire =>
  createRequire(
    typeof __filename !== "undefined" ? __filename : import.meta.url,
  );

export const resolvePackageDir = (packageName: string): string => {
  const require = makeRequire();
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch (cause) {
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
    throw new AdapterNotFoundError(packageName, cause);
  }
};
