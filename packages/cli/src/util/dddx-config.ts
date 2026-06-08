import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type DddxAppConfig = {
  port?: string | number;
  script?: string;
  name?: string;
};

export type DddxRootConfig = {
  script?: string;
  apps?: Record<string, DddxAppConfig>;
};

function readPackageJson(dir: string): Record<string, unknown> | null {
  const file = path.join(dir, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function loadDddxConfig(dir: string): DddxRootConfig | null {
  const pkg = readPackageJson(dir);
  if (!pkg || typeof pkg.dddx !== "object" || pkg.dddx === null) return null;
  return pkg.dddx as DddxRootConfig;
}

export function loadPackageDddxConfig(dir: string): DddxAppConfig | null {
  const pkg = readPackageJson(dir);
  if (!pkg || typeof pkg.dddx !== "object" || pkg.dddx === null) return null;
  const dddx = pkg.dddx as Record<string, unknown>;
  if ("apps" in dddx) return null;
  return dddx as DddxAppConfig;
}

export function hasScript(scriptName: string, dir: string): boolean {
  const pkg = readPackageJson(dir);
  const scripts = pkg?.scripts;
  if (!scripts || typeof scripts !== "object") return false;
  return scriptName in (scripts as Record<string, string>);
}
