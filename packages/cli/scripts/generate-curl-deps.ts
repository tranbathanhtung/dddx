/**
 * Generate per-platform curl install manifests (small JSON) for publish.
 * The curl installer downloads each listed tarball from the npm registry.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import {
  OPTIONAL_DEPENDENCIES,
  RUNTIME_DEPENDENCIES,
} from "./prepare-publish.ts";

const root = join(import.meta.dir, "..");
const stagingDir = join(root, ".publish-staging");
const outDir = join(root, "curl-deps");

export type CurlDep = {
  path: string;
  name: string;
  version: string;
  tarball: string;
};

type PlatformSpec = {
  id: string;
  optional: string[];
};

const PLATFORMS: PlatformSpec[] = [
  {
    id: "darwin-arm64",
    optional: [
      `@parcel/watcher-darwin-arm64@${OPTIONAL_DEPENDENCIES["@parcel/watcher-darwin-arm64"]}`,
      `@zed-industries/codex-acp-darwin-arm64@${OPTIONAL_DEPENDENCIES["@zed-industries/codex-acp-darwin-arm64"]}`,
    ],
  },
  {
    id: "darwin-x64",
    optional: [
      `@parcel/watcher-darwin-x64@${OPTIONAL_DEPENDENCIES["@parcel/watcher-darwin-x64"]}`,
      `@zed-industries/codex-acp-darwin-x64@${OPTIONAL_DEPENDENCIES["@zed-industries/codex-acp-darwin-x64"]}`,
    ],
  },
  {
    id: "linux-arm64",
    optional: [
      `@parcel/watcher-linux-arm64-glibc@${OPTIONAL_DEPENDENCIES["@parcel/watcher-linux-arm64-glibc"]}`,
      `@zed-industries/codex-acp-linux-arm64@${OPTIONAL_DEPENDENCIES["@zed-industries/codex-acp-linux-arm64"]}`,
    ],
  },
  {
    id: "linux-x64",
    optional: [
      `@parcel/watcher-linux-x64-glibc@${OPTIONAL_DEPENDENCIES["@parcel/watcher-linux-x64-glibc"]}`,
      `@zed-industries/codex-acp-linux-x64@${OPTIONAL_DEPENDENCIES["@zed-industries/codex-acp-linux-x64"]}`,
    ],
  },
  {
    id: "win32-arm64",
    optional: [
      `@zed-industries/codex-acp-win32-arm64@${OPTIONAL_DEPENDENCIES["@zed-industries/codex-acp-win32-arm64"]}`,
    ],
  },
  {
    id: "win32-x64",
    optional: [
      `@parcel/watcher-win32-x64@${OPTIONAL_DEPENDENCIES["@parcel/watcher-win32-x64"]}`,
      `@zed-industries/codex-acp-win32-x64@${OPTIONAL_DEPENDENCIES["@zed-industries/codex-acp-win32-x64"]}`,
    ],
  },
];

async function run(command: string[], cwd: string): Promise<number> {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}

function publishablePackageJson(): Record<string, unknown> {
  const source = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ) as { name: string; version: string };
  return {
    name: source.name,
    version: source.version,
    dependencies: RUNTIME_DEPENDENCIES,
    optionalDependencies: OPTIONAL_DEPENDENCIES,
  };
}

function walkFromDir(
  physicalDir: string,
  relPath: string,
): Omit<CurlDep, "tarball">[] {
  const pkgJson = join(physicalDir, "package.json");
  if (!existsSync(pkgJson)) return [];

  const pkg = JSON.parse(readFileSync(pkgJson, "utf8")) as {
    name: string;
    version: string;
  };

  const results: Omit<CurlDep, "tarball">[] = [
    { path: relPath, name: pkg.name, version: pkg.version },
  ];

  const nested = join(physicalDir, "node_modules");
  if (!existsSync(nested)) return results;

  for (const entry of readdirSync(nested)) {
    if (entry.startsWith(".")) continue;
    if (entry.startsWith("@")) {
      for (const scoped of readdirSync(join(nested, entry))) {
        const childRel = `${relPath}/node_modules/${entry}/${scoped}`;
        results.push(
          ...walkFromDir(join(nested, entry, scoped), childRel),
        );
      }
      continue;
    }
    const childRel = `${relPath}/node_modules/${entry}`;
    results.push(...walkFromDir(join(nested, entry), childRel));
  }

  return results;
}

function collectInstalledDeps(modulesRoot: string): Omit<CurlDep, "tarball">[] {
  const results: Omit<CurlDep, "tarball">[] = [];
  if (!existsSync(modulesRoot)) return results;

  for (const entry of readdirSync(modulesRoot)) {
    if (entry.startsWith(".")) continue;
    if (entry.startsWith("@")) {
      for (const scoped of readdirSync(join(modulesRoot, entry))) {
        const rel = `${entry}/${scoped}`;
        results.push(...walkFromDir(join(modulesRoot, entry, scoped), rel));
      }
      continue;
    }
    results.push(...walkFromDir(join(modulesRoot, entry), entry));
  }

  return results;
}

const tarballCache = new Map<string, string>();

async function resolveTarball(name: string, version: string): Promise<string> {
  const key = `${name}@${version}`;
  const cached = tarballCache.get(key);
  if (cached) return cached;

  const encoded = encodeURIComponent(name);
  const res = await fetch(`https://registry.npmjs.org/${encoded}/${version}`);
  if (!res.ok) {
    throw new Error(`Registry lookup failed for ${key}: ${res.status}`);
  }
  const data = (await res.json()) as { dist?: { tarball?: string } };
  const tarball = data.dist?.tarball;
  if (!tarball) throw new Error(`No tarball URL for ${key}`);
  tarballCache.set(key, tarball);
  return tarball;
}

async function generateForPlatform(spec: PlatformSpec): Promise<CurlDep[]> {
  await rm(stagingDir, { recursive: true, force: true });
  mkdirSync(join(stagingDir, "bin"), { recursive: true });
  writeFileSync(
    join(stagingDir, "package.json"),
    `${JSON.stringify(publishablePackageJson(), null, 2)}\n`,
  );

  const baseCode = await run(
    [
      "npm",
      "install",
      "--omit=dev",
      "--omit=optional",
      "--no-audit",
      "--no-fund",
      "--loglevel=error",
    ],
    stagingDir,
  );
  if (baseCode !== 0) {
    throw new Error(`npm install failed for platform ${spec.id}`);
  }

  if (spec.optional.length > 0) {
    const platformCode = await run(
      [
        "npm",
        "install",
        "--no-save",
        "--no-audit",
        "--no-fund",
        "--loglevel=error",
        ...spec.optional,
      ],
      stagingDir,
    );
    if (platformCode !== 0) {
      throw new Error(`Platform optional install failed for ${spec.id}`);
    }
  }

  const raw = collectInstalledDeps(join(stagingDir, "node_modules"));
  const seen = new Set<string>();
  const unique = raw.filter((dep) => {
    if (seen.has(dep.path)) return false;
    seen.add(dep.path);
    return true;
  });

  const deps: CurlDep[] = [];
  for (const dep of unique) {
    deps.push({
      ...dep,
      tarball: await resolveTarball(dep.name, dep.version),
    });
  }

  return deps.sort((a, b) => a.path.localeCompare(b.path));
}

export async function generateCurlDeps(): Promise<void> {
  console.log("Generating curl-deps manifests…");
  await rm(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const spec of PLATFORMS) {
    const deps = await generateForPlatform(spec);
    const outPath = join(outDir, `${spec.id}.json`);
    writeFileSync(outPath, `${JSON.stringify(deps, null, 2)}\n`);
    console.log(`✓ ${spec.id}.json (${deps.length} packages)`);
  }

  await rm(stagingDir, { recursive: true, force: true });
  console.log("✓ curl-deps manifests ready");
}

export async function cleanupCurlDeps(): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await rm(stagingDir, { recursive: true, force: true });
}

if (import.meta.main) {
  generateCurlDeps().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
