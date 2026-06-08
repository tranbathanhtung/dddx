import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import chalk from "chalk";

import {
  findWorkspaceRoot,
  discoverWorkspacePackages,
  type WorkspacePackage,
} from "@/portless/workspace";
import { detectPackageManager } from "../detect";
import {
  hasScript,
  loadDddxConfig,
  loadPackageDddxConfig,
  type DddxAppConfig,
  type DddxRootConfig,
} from "./dddx-config";

export type DevApp = {
  relPath: string;
  dir: string;
  label: string;
  script: string;
  /** When true, dddx starts a proxy and registers a studio preview target. */
  proxied: boolean;
  proxyPort: number;
  packageManager: string;
};

export type DevDiscovery =
  | {
      mode: "single";
      wsRoot: string | null;
      apps: [DevApp];
      script: string;
      dddxConfig: DddxRootConfig | null;
    }
  | {
      mode: "multi";
      wsRoot: string;
      apps: DevApp[];
      script: string;
      dddxConfig: DddxRootConfig | null;
    };

export type DevDiscoveryNeedsConfig = {
  kind: "needs-config";
  wsRoot: string;
  devPackages: string[];
};

export type DevDiscoveryResult = DevDiscovery | DevDiscoveryNeedsConfig | null;

function packageLabel(pkg: WorkspacePackage, rel: string): string {
  if (pkg.scope && pkg.name) return `@${pkg.scope}/${pkg.name}`;
  if (pkg.name) return pkg.name;
  return rel;
}

function readPackageName(dir: string): string | null {
  try {
    const raw = JSON.parse(
      readFileSync(path.join(dir, "package.json"), "utf-8"),
    ) as { name?: string };
    return typeof raw.name === "string" ? raw.name : null;
  } catch {
    return null;
  }
}

function buildAppEntry(
  wsRoot: string,
  relPath: string,
  pkg: WorkspacePackage | null,
  scriptName: string,
  override?: DddxAppConfig | null,
  proxied = false,
): DevApp | null {
  const dir = path.join(wsRoot, relPath);
  if (!existsSync(path.join(dir, "package.json"))) return null;

  const effectiveScript = override?.script ?? scriptName;
  const scripts = pkg?.scripts ?? readScripts(dir);
  if (!scripts?.[effectiveScript]) return null;

  const label =
    override?.name ??
    (pkg ? packageLabel(pkg, relPath) : (readPackageName(dir) ?? relPath));

  return {
    relPath,
    dir,
    label,
    script: effectiveScript,
    proxied,
    proxyPort: 0,
    packageManager: "npm",
  };
}

function readScripts(dir: string): Record<string, string> | null {
  try {
    const raw = JSON.parse(
      readFileSync(path.join(dir, "package.json"), "utf-8"),
    ) as { scripts?: Record<string, string> };
    return raw.scripts ?? null;
  } catch {
    return null;
  }
}

function assignProxyPorts(
  apps: DevApp[],
  basePort: number,
  configured?: Record<string, DddxAppConfig>,
): void {
  const used = new Set<number>();
  let next = basePort;

  for (const app of apps) {
    const configuredPort = configured?.[app.relPath]?.port;
    if (configuredPort !== undefined) {
      app.proxyPort = Number.parseInt(String(configuredPort), 10);
      used.add(app.proxyPort);
      continue;
    }

    while (used.has(next)) next += 1;
    app.proxyPort = next;
    used.add(next);
    next += 1;
  }
}

function listDevPackages(wsRoot: string, scriptName: string): string[] {
  return discoverWorkspacePackages(wsRoot)
    .map((pkg) => path.relative(wsRoot, pkg.dir).replace(/\\/g, "/"))
    .filter((rel) => hasScript(scriptName, path.join(wsRoot, rel)))
    .sort();
}

function discoverMultiApps(
  wsRoot: string,
  scriptName: string,
  dddxConfig: DddxRootConfig,
  basePort: number,
): DevApp[] {
  const packages = discoverWorkspacePackages(wsRoot);
  const configuredApps = dddxConfig.apps ?? {};
  const apps: DevApp[] = [];

  for (const pkg of packages) {
    const rel = path.relative(wsRoot, pkg.dir).replace(/\\/g, "/");
    const appCfg = configuredApps[rel];
    const proxied = rel in configuredApps;
    const entry = buildAppEntry(
      wsRoot,
      rel,
      pkg,
      scriptName,
      appCfg,
      proxied,
    );
    if (entry) apps.push(entry);
  }

  apps.sort((a, b) => a.label.localeCompare(b.label));

  const proxiedApps = apps.filter((app) => app.proxied);
  assignProxyPorts(proxiedApps, basePort, configuredApps);
  return apps;
}

function discoverSingleApp(
  cwd: string,
  scriptName: string,
  proxyPort: number,
): DevApp {
  const relPath = ".";
  const pkgOverride = loadPackageDddxConfig(cwd);
  const effectiveScript = pkgOverride?.script ?? scriptName;
  const name =
    pkgOverride?.name ?? readPackageName(cwd) ?? (path.basename(cwd) || "app");

  return {
    relPath,
    dir: cwd,
    label: name,
    script: effectiveScript,
    proxied: true,
    proxyPort:
      pkgOverride?.port !== undefined
        ? Number.parseInt(String(pkgOverride.port), 10)
        : proxyPort,
    packageManager: "npm",
  };
}

async function attachPackageManagers(apps: DevApp[]): Promise<void> {
  await Promise.all(
    apps.map(async (app) => {
      app.packageManager = await detectPackageManager(app.dir);
    }),
  );
}

export function printMonorepoConfigGuide(
  wsRoot: string,
  devPackages: string[],
): void {
  const exampleApps = Object.fromEntries(
    devPackages.map((rel, index) => [
      rel,
      { port: String(3000 + index) },
    ]),
  );

  console.error(
    chalk.yellow("\n⚠ Monorepo detected — add dddx.apps to your root package.json.\n"),
  );
  console.error(
    chalk.white(
      "dddx starts every workspace package with a dev script, and proxies only the apps you list under dddx.apps.\n",
    ),
  );
  console.error(chalk.cyan("Example configuration:\n"));
  console.error(
    chalk.gray(
      JSON.stringify(
        {
          dddx: {
            script: "dev",
            apps: exampleApps,
          },
        },
        null,
        2,
      ),
    ),
  );
  console.error("");
  if (devPackages.length > 0) {
    console.error(chalk.white("Packages with a dev script in this workspace:"));
    for (const rel of devPackages) {
      console.error(chalk.gray(`  • ${rel}`));
    }
    console.error("");
  }
  console.error(
    chalk.dim(`Root: ${wsRoot}\n`),
  );
}

export async function discoverDevApps(
  cwd: string,
  options: { script?: string; port?: string },
): Promise<DevDiscoveryResult> {
  const resolved = path.resolve(cwd);
  const wsRoot = findWorkspaceRoot(resolved);
  const dddxConfig = wsRoot ? loadDddxConfig(wsRoot) : loadDddxConfig(resolved);
  const scriptName = options.script ?? dddxConfig?.script ?? "dev";
  const basePort = Number.parseInt(options.port ?? "3000", 10);

  if (wsRoot && wsRoot === resolved) {
    const configuredApps = dddxConfig?.apps;
    if (!configuredApps || Object.keys(configuredApps).length === 0) {
      return {
        kind: "needs-config",
        wsRoot,
        devPackages: listDevPackages(wsRoot, scriptName),
      };
    }

    const apps = discoverMultiApps(wsRoot, scriptName, dddxConfig, basePort);
    if (apps.length > 0) {
      await attachPackageManagers(apps);
      return {
        mode: apps.length === 1 ? "single" : "multi",
        wsRoot,
        apps: apps.length === 1 ? [apps[0]!] : apps,
        script: scriptName,
        dddxConfig,
      } as DevDiscovery;
    }
  }

  if (!hasScript(scriptName, resolved)) {
    return null;
  }

  const apps = [discoverSingleApp(resolved, scriptName, basePort)];
  await attachPackageManagers(apps);

  return {
    mode: "single",
    wsRoot,
    apps: [apps[0]!],
    script: scriptName,
    dddxConfig,
  };
}
