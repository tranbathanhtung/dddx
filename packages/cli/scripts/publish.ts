/**
 * Publish @dddx/cli with a publish-only package.json, always restoring the
 * monorepo manifest even when typecheck, build, or npm publish fails.
 */

import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  cleanupCurlDeps,
  generateCurlDeps,
} from "./generate-curl-deps.ts";
import { preparePublishPackageJson } from "./prepare-publish.ts";
import { restorePublishPackageJson } from "./restore-publish.ts";

const root = join(import.meta.dir, "..");
const backupPath = join(root, "package.json.monorepo");

function npmPublishArgs(tarballPath: string): string[] {
  const args = ["publish", tarballPath, "--access", "public", "--ignore-scripts"];

  const fromEnv = process.env.NPM_OTP?.trim();
  if (fromEnv) {
    args.push(`--otp=${fromEnv}`);
    return args;
  }

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i]!;
    if (arg.startsWith("--otp=")) {
      args.push(arg);
      continue;
    }
    if (arg === "--otp") {
      const code = process.argv[i + 1];
      if (code) args.push(`--otp=${code}`);
      break;
    }
  }

  return args;
}

async function run(command: string[]): Promise<number> {
  const proc = Bun.spawn(command, {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}

async function packTarball(version: string): Promise<string> {
  const packCode = await run(["npm", "pack", "--pack-destination", root]);
  if (packCode !== 0) {
    throw new Error("npm pack failed");
  }

  const expected = `dddx-cli-${version}.tgz`;
  const direct = join(root, expected);
  if (existsSync(direct)) return direct;

  const files = await readdir(root);
  const match = files.find(
    (file) => file.startsWith("dddx-cli-") && file.endsWith(".tgz"),
  );
  if (!match) {
    throw new Error("npm pack did not produce a tarball");
  }
  return join(root, match);
}

async function verifyPublishedTarball(version: string): Promise<void> {
  const registryUrl = `https://registry.npmjs.org/@dddx/cli/${version}`;
  let tarballUrl = `https://registry.npmjs.org/@dddx/cli/-/cli-${version}.tgz`;

  const maxAttempts = 12;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const metaRes = await fetch(registryUrl);
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as { dist?: { tarball?: string } };
        if (meta.dist?.tarball) tarballUrl = meta.dist.tarball;
      }
    } catch {
      // Fall back to the default tarball URL.
    }

    const res = await fetch(tarballUrl, { method: "GET" });
    if (res.ok) {
      console.log(`✓ Verified npm tarball: ${tarballUrl}`);
      return;
    }

    if (attempt < maxAttempts) {
      const waitMs = Math.min(5000 * attempt, 30000);
      console.log(
        `  Tarball not ready (HTTP ${res.status}), retrying in ${waitMs / 1000}s…`,
      );
      await Bun.sleep(waitMs);
    } else {
      throw new Error(
        `Published tarball not found after publish (HTTP ${res.status}): ${tarballUrl}`,
      );
    }
  }
}

async function main() {
  if (existsSync(backupPath)) {
    console.warn("Restoring package.json from a previous incomplete publish…");
    restorePublishPackageJson();
  }

  const typecheckCode = await run(["bun", "run", "typecheck"]);
  if (typecheckCode !== 0) process.exit(typecheckCode);

  const buildCode = await run(["bun", "run", "build"]);
  if (buildCode !== 0) process.exit(buildCode);

  preparePublishPackageJson();

  const version = (
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;

  let packedTarball: string | null = null;
  let exitCode = 1;
  try {
    await generateCurlDeps();

    packedTarball = await packTarball(version);
    console.log(`✓ Packed ${packedTarball}`);

    exitCode = await run(["npm", ...npmPublishArgs(packedTarball)]);
    if (exitCode === 0) {
      await verifyPublishedTarball(version);
    }
  } finally {
    if (packedTarball && existsSync(packedTarball)) {
      const { rm } = await import("node:fs/promises");
      await rm(packedTarball, { force: true });
    }
    await cleanupCurlDeps();
    restorePublishPackageJson();
  }

  process.exit(exitCode);
}

main().catch(async (error) => {
  console.error(error);
  await cleanupCurlDeps();
  restorePublishPackageJson();
  process.exit(1);
});
