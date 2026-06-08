import { spawn } from "node:child_process";

export type AutoOpenOptions = {
  openBrowser?: boolean;
  isHot?: boolean;
};

/** Whether this dev run should try to open Studio in the system browser. */
export function shouldAutoOpenBrowser(options: AutoOpenOptions): boolean {
  if (options.openBrowser === false || options.isHot) return false;
  if (!process.stdout.isTTY) return false;
  if (process.env.CI) return false;
  return true;
}

/** Best-effort open `url` in the default browser; never throws. */
export function openInBrowser(url: string): void {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  try {
    spawn(command, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // non-fatal
  }
}
