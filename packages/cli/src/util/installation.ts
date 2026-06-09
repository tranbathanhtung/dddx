import { exec, spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import z from "zod";

const execAsync = promisify(exec);

/** Public site origin for the bash installer (`/install`), not the SDK CDN. */
export const SITE_ORIGIN = "https://dddx.dev";

async function runCommand(
  command: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(command);
    return {
      exitCode: 0,
      stdout: typeof stdout === "string" ? stdout : "",
      stderr: typeof stderr === "string" ? stderr : "",
    };
  } catch (err) {
    const failed = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };
    const code =
      typeof failed.code === "number"
        ? failed.code
        : typeof failed.code === "string" && failed.code !== ""
          ? 1
          : 1;
    return {
      exitCode: code,
      stdout: typeof failed.stdout === "string" ? failed.stdout : "",
      stderr:
        typeof failed.stderr === "string"
          ? failed.stderr
          : (failed.message ?? ""),
    };
  }
}

export namespace Installation {
  export type Method = Awaited<ReturnType<typeof method>>;

  export const Info = z
    .object({
      version: z.string(),
      latest: z.string(),
    })
    .meta({
      ref: "InstallationInfo",
    });
  export type Info = z.infer<typeof Info>;

  export async function info() {
    return {
      version: VERSION,
      latest: await latest(),
    };
  }

  export function isPreview() {
    return CHANNEL !== "latest";
  }

  export function isLocal() {
    return CHANNEL === "local";
  }

  /** Path to the running CLI binary (not the Node/Bun runtime). */
  export function executablePath() {
    const script = process.argv[1];
    if (!script) return process.execPath;
    try {
      return realpathSync(script);
    } catch {
      return path.resolve(script);
    }
  }

  export async function method() {
    const execPath = executablePath();
    if (execPath.includes(path.join(".dddx", "bin"))) return "curl";
    if (execPath.includes(path.join(".local", "bin"))) return "curl";
    const exec = execPath.toLowerCase();

    const checks = [
      {
        name: "npm" as const,
        command: () => runCommand("npm list -g --depth=0"),
      },
      {
        name: "yarn" as const,
        command: () => runCommand("yarn global list"),
      },
      {
        name: "pnpm" as const,
        command: () => runCommand("pnpm list -g --depth=0"),
      },
      {
        name: "bun" as const,
        command: () => runCommand("bun pm ls -g"),
      },
      {
        name: "brew" as const,
        command: () => runCommand("brew list --formula @dddx/cli"),
      },
    ];

    checks.sort((a, b) => {
      const aMatches = exec.includes(a.name);
      const bMatches = exec.includes(b.name);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });

    for (const check of checks) {
      const { stdout } = await check.command();
      if (stdout.includes("@dddx/cli")) {
        return check.name;
      }
    }

    return "unknown";
  }

  export function installOrigin(): string {
    const fromEnv = process.env.DDDX_ORIGIN?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    return SITE_ORIGIN;
  }

  export function installScriptUrl(origin = installOrigin()): string {
    return `${origin.replace(/\/$/, "")}/install`;
  }

  export async function uninstall(method: Method) {
    if (method === "curl") {
      await uninstallCurl();
    } else {
      const command = (() => {
        switch (method) {
          case "npm":
            return "npm uninstall -g @dddx/cli";
          case "pnpm":
            return "pnpm remove -g @dddx/cli";
          case "bun":
            return "bun remove -g @dddx/cli";
          case "yarn":
            return "yarn global remove @dddx/cli";
          case "brew":
            return "brew uninstall @dddx/cli";
          default:
            throw new Error(`Unknown installation method: ${method}`);
        }
      })();

      const result = await runCommand(command);
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || `Command failed: ${command}`);
      }
    }

    await removeGlobalFolder();
  }

  async function uninstallCurl() {
    const { rm } = await import("node:fs/promises");
    const os = await import("node:os");
    const home = os.homedir();

    const candidates = [
      path.join(home, ".dddx", "bin", "dddx"),
      path.join(home, ".local", "bin", "dddx"),
    ];

    let removed = false;
    for (const candidate of candidates) {
      try {
        await rm(candidate, { force: true });
        removed = true;
      } catch {
        // file may not exist at this path
      }
    }

    if (!removed) {
      throw new Error(
        "Could not find the dddx binary to remove. You may need to delete it manually.",
      );
    }
  }

  export async function removeGlobalFolder(): Promise<boolean> {
    const { rm } = await import("node:fs/promises");
    const os = await import("node:os");
    const globalDir = path.join(os.homedir(), ".dddx");
    try {
      await rm(globalDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  export async function upgrade(method: Method, target: string) {
    if (method === "curl") {
      await upgradeCurl(target);
      return;
    }

    const command = (() => {
      switch (method) {
        case "npm":
          return `npm install -g @dddx/cli@${target}`;
        case "pnpm":
          return `pnpm install -g @dddx/cli@${target}`;
        case "bun":
          return `bun install -g @dddx/cli@${target}`;
        case "yarn":
          return `yarn global add @dddx/cli@${target}`;
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    })();

    const result = await runCommand(command);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || `Command failed: ${command}`);
    }
  }

  async function upgradeCurl(target: string) {
    const version = target.replace(/^v/, "");
    const script = installScriptUrl();
    const shell = [
      "set -o pipefail",
      `curl -fsSL --connect-timeout 15 --max-time 300 ${shellQuote(script)}`,
      `bash -s -- --version ${shellQuote(version)} --no-modify-path`,
    ].join(" | ");

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("bash", ["-c", shell], {
        stdio: "inherit",
        env: process.env,
      });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      throw new Error(`curl install failed (exit ${exitCode})`);
    }
  }

  function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  export const VERSION =
    typeof DDDX_VERSION === "string" ? DDDX_VERSION : "local";
  export const CHANNEL =
    typeof DDDX_CHANNEL === "string" ? DDDX_CHANNEL : "local";
  export const USER_AGENT = `dddx/${CHANNEL}/${VERSION}`;

  export async function latest() {
    const channel = CHANNEL === "latest" ? `latest` : CHANNEL;
    const res = await fetch(
      `https://registry.npmjs.org/@dddx/cli/${channel}`,
    );
    if (!res.ok) throw new Error(res.statusText);
    const data = (await res.json()) as { version: string };
    return data.version;
  }

  function parseVersion(version: string): number[] {
    return version
      .replace(/^v/, "")
      .split(".")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10) || 0);
  }

  export function isOutdated(current: string, target: string): boolean {
    if (current === target || current === "local" || target === "local") {
      return false;
    }

    const a = parseVersion(current);
    const b = parseVersion(target);

    for (let i = 0; i < 3; i += 1) {
      const diff = (b[i] ?? 0) - (a[i] ?? 0);
      if (diff > 0) return true;
      if (diff < 0) return false;
    }

    return false;
  }
}
