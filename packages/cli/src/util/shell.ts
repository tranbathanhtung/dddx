import { spawnSync } from "node:child_process";

export function execText(
  command: string,
  args: string[],
  opts?: {
    cwd?: string;
    quiet?: boolean;
    nothrow?: boolean;
  },
): string {
  const result = spawnSync(command, args, {
    cwd: opts?.cwd,
    encoding: "utf-8",
    stdio: opts?.quiet ? "pipe" : "inherit",
  });

  if (result.error && !opts?.nothrow) {
    throw result.error;
  }

  if (result.status !== 0 && !opts?.nothrow) {
    const stderr = result.stderr?.toString().trim();
    throw new Error(
      stderr ||
        `${command} ${args.join(" ")} exited with code ${result.status ?? "unknown"}`,
    );
  }

  return result.stdout?.toString() ?? "";
}
