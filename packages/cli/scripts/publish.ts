/**
 * Publish @dddx/cli with a publish-only package.json, always restoring the
 * monorepo manifest even when typecheck, build, or npm publish fails.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { preparePublishPackageJson } from "./prepare-publish.ts";
import { restorePublishPackageJson } from "./restore-publish.ts";

const root = join(import.meta.dir, "..");
const backupPath = join(root, "package.json.monorepo");

function npmPublishArgs(): string[] {
  const args = ["publish", "--access", "public", "--ignore-scripts"];

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

  let exitCode = 1;
  try {
    exitCode = await run(["npm", ...npmPublishArgs()]);
  } finally {
    restorePublishPackageJson();
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  restorePublishPackageJson();
  process.exit(1);
});
