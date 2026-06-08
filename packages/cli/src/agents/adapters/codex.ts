import { chmodSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { AdapterFactoryOptions, AgentAdapter } from "spawn-agent";
import { AdapterNotFoundError } from "spawn-agent";
import { resolvePackageDir } from "../resolve-package";

const PROVIDER = "codex";

const PLATFORM_PACKAGES: Partial<
  Record<NodeJS.Platform, Partial<Record<NodeJS.Architecture, string>>>
> = {
  darwin: {
    arm64: "codex-acp-darwin-arm64",
    x64: "codex-acp-darwin-x64",
  },
  linux: {
    arm64: "codex-acp-linux-arm64",
    x64: "codex-acp-linux-x64",
  },
  win32: {
    arm64: "codex-acp-win32-arm64",
    x64: "codex-acp-win32-x64",
  },
};

/** npm tarballs omit the executable bit; curl installs do not run npm's bin linker. */
const ensureExecutable = (filePath: string): string => {
  if (process.platform === "win32") return filePath;
  try {
    const mode = statSync(filePath).mode & 0o777;
    if ((mode & 0o111) === 0) chmodSync(filePath, mode | 0o755);
  } catch {
    // ignore — spawn will surface a clearer error
  }
  return filePath;
};

/** Native ACP binary (not the Node shim, which uses spawnSync and orphans on kill). */
const resolveCodexAcpBinary = (): string => {
  const packageName = PLATFORM_PACKAGES[process.platform]?.[process.arch];
  if (!packageName) {
    throw new AdapterNotFoundError(
      PROVIDER,
      new Error(`unsupported platform: ${process.platform} ${process.arch}`),
    );
  }
  const binary = process.platform === "win32" ? "bin/codex-acp.exe" : "bin/codex-acp";
  const metaRoot = resolvePackageDir("@zed-industries/codex-acp");
  const require = createRequire(path.join(metaRoot, "package.json"));
  return ensureExecutable(
    require.resolve(`@zed-industries/${packageName}/${binary}`),
  );
};

export const codex = (options: AdapterFactoryOptions = {}): AgentAdapter => ({
  id: PROVIDER,
  displayName: "Codex",
  checkInstalled: async () => {
    return true;
  },
  checkAuthenticated: async () => {
    return true;
  },
  resolve: async () => {
    if (options.binPath) {
      return { bin: options.binPath, args: [], env: options.env ?? {} };
    }
    return {
      bin: resolveCodexAcpBinary(),
      args: [],
      env: options.env ?? {},
    };
  },
});
