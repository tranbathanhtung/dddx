import type { ChildProcess } from "node:child_process";
import chalk from "chalk";

import {
  augmentedPath,
  findFreePort,
  injectFrameworkFlags,
  isPortListening,
  killListenerOnPort,
  killTree,
  spawnShellCommand,
} from "@/portless/cli-utils";
import {
  startProxyServer,
  createDevProxyOptions,
  type ManagedProxyServer,
} from "./proxy";
import {
  killStudioWorkerSync,
  startStudioServer,
  registerPreviewTargets,
  resolveStudioPort,
  type PreviewTarget,
} from "@/studio";
import { Log } from "./util/log";
import {
  DISPLAY_HOST,
  LISTEN_HOST,
  displayUrl,
} from "./util/service-endpoints";
import { ProcessLifecycle } from "./util/lifecycle";
import { checkForUpdate, printDevBanner } from "./tui/index";
import {
  discoverDevApps,
  printMonorepoConfigGuide,
  type DevApp,
} from "./util/dev-apps";
import { Installation } from "./util/installation";
import { openInBrowser, shouldAutoOpenBrowser } from "./util/open-browser";
import type { Config } from "./detect";

const cliVersion = Installation.VERSION;

const log = Log.create({ service: "dev" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolve when `promise` settles or `ms` elapses — never rejects. */
function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    void Promise.resolve(promise).finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export type DevOptions = {
  port?: string;
  script?: string;
  command?: string;
  debug?: boolean;
  /** Open Studio in the system browser on the first project run. */
  openBrowser?: boolean;
  projectConfig: Config;
  userSetPort: boolean;
  /** True under `bun --hot`; keeps the process alive across module reloads. */
  isHot?: boolean;
};

/** Handle returned from {@link runDev} so callers can tear the run down. */
export type DevHandle = {
  teardown: () => Promise<void>;
};

type AppRuntime = {
  app: DevApp;
  appPort: number;
  proxy?: ManagedProxyServer;
  child?: ChildProcess;
};

function previewUrl(proxyPort: number): string {
  return displayUrl(proxyPort);
}

function toPreviewTargets(runtimes: AppRuntime[]): PreviewTarget[] {
  return runtimes
    .filter(({ app }) => app.proxied)
    .map(({ app }) => ({
      id: app.relPath,
      label: app.label,
      url: previewUrl(app.proxyPort),
      port: app.proxyPort,
      path: app.relPath === "." ? undefined : app.relPath,
    }));
}

/**
 * Wait until nothing is listening on `port`. On `bun --hot` reloads the
 * previous proxy is torn down asynchronously, so the fresh evaluation must
 * wait for the port to free up before re-binding (otherwise EADDRINUSE).
 */
async function waitForPortFree(port: number, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortListening(port))) return;
    await sleep(150);
  }
}

async function startAppRuntimes(apps: DevApp[]): Promise<AppRuntime[]> {
  const runtimes: AppRuntime[] = [];

  for (const app of apps) {
    if (!app.proxied) {
      runtimes.push({ app, appPort: 0 });
      continue;
    }

    const appPort = await findFreePort();
    await waitForPortFree(app.proxyPort);
    const proxy = await startProxyServer(
      createDevProxyOptions({ proxyPort: app.proxyPort, appPort }),
    );
    runtimes.push({ app, appPort, proxy });
  }

  return runtimes;
}

function buildServerCommand(
  app: DevApp,
  projectConfig: Config,
  options: DevOptions,
  appPort: number,
): string {
  if (options.command) return options.command;

  const script = app.script;
  if (projectConfig.type === "python") {
    return `${projectConfig.pythonCommand} ${script}`;
  }
  if (projectConfig.type === "rails") {
    let cmd = `bundle exec rails ${script}`;
    if (options.userSetPort) cmd += ` -p ${appPort}`;
    return cmd;
  }

  let cmd = `${app.packageManager || projectConfig.packageManager} run ${script}`;
  if (options.userSetPort) {
    if (projectConfig.framework === "nextjs") {
      cmd += ` -p ${appPort}`;
    } else {
      cmd += ` --port ${appPort}`;
    }
  }
  return cmd;
}

function stopAppRuntime(
  runtime: AppRuntime,
  signal: NodeJS.Signals = "SIGTERM",
): void {
  if (runtime.child) killTree(runtime.child, signal);
  killListenerOnPort(runtime.appPort, signal);
}

function spawnApp(runtime: AppRuntime, options: DevOptions): ChildProcess {
  const proxied = runtime.app.proxied;
  const serverCommand = buildServerCommand(
    runtime.app,
    options.projectConfig,
    proxied ? options : { ...options, userSetPort: false },
    runtime.appPort,
  );
  const commands = serverCommand.split(" ");
  if (proxied) {
    injectFrameworkFlags(commands, runtime.appPort);
  }

  if (options.debug) {
    log.info("Starting dev server", {
      app: runtime.app.label,
      proxied,
      proxyPort: proxied ? runtime.app.proxyPort : undefined,
      appPort: proxied ? runtime.appPort : undefined,
      serverCommand: commands.join(" "),
    });
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: augmentedPath(process.env, runtime.app.dir),
  };
  if (proxied) {
    env.PORT = String(runtime.appPort);
    env.HOST = LISTEN_HOST;
  }

  const child = spawnShellCommand(commands, {
    cwd: runtime.app.dir,
    env,
  });

  runtime.child = child;
  return child;
}

export async function runDev(options: DevOptions): Promise<DevHandle> {
  const projectDir = process.cwd();
  const discovery = await discoverDevApps(projectDir, {
    script: options.script,
    port: options.port,
  });

  if (!discovery) {
    console.error(
      chalk.red(`Error: No "${options.script ?? "dev"}" script found.`),
    );
    process.exit(1);
  }

  if ("kind" in discovery && discovery.kind === "needs-config") {
    printMonorepoConfigGuide(discovery.wsRoot, discovery.devPackages);
    process.exit(1);
  }

  if (!("mode" in discovery)) {
    process.exit(1);
  }

  const studioPort = resolveStudioPort();
  const runtimes = await startAppRuntimes(discovery.apps);
  const syncPreviewTargets = () =>
    registerPreviewTargets(studioPort, projectDir, toPreviewTargets(runtimes));
  const studio = await startStudioServer({
    port: studioPort,
    onBeforeAttach: syncPreviewTargets,
  });
  await syncPreviewTargets();
  let tearingDown = false;
  let teardownPromise: Promise<void> | null = null;
  let devLifecycle!: ProcessLifecycle.Handle;

  const teardown = async (): Promise<void> => {
    if (teardownPromise) return teardownPromise;

    tearingDown = true;
    devLifecycle.dispose();

    teardownPromise = (async () => {
      // Ask the dev servers to stop gracefully first.
      for (const runtime of runtimes) {
        stopAppRuntime(runtime, "SIGINT");
      }

      // Detach studio and force-stop the local resources concurrently. The
      // studio worker is shared and self-terminates once our lease drops, so
      // detaching must not block process exit — bound it with a timeout.
      await Promise.all([
        withTimeout(studio.close(), 1_500),
        ...runtimes.map(async (runtime) => {
          stopAppRuntime(runtime, "SIGKILL");
          try {
            runtime.proxy?.close();
          } catch {
            // non-fatal
          }
        }),
      ]);
    })();

    return teardownPromise;
  };

  const exitClean = (code: number) => {
    process.exitCode = code;
    void teardown().finally(() => process.exit(code));
  };

  const onSignal = () => {
    if (tearingDown) {
      process.exit(0);
      return;
    }
    exitClean(0);
  };

  // Synchronous best-effort reap if the process is torn down hard (not via
  // signal or hot reload). Safe to run alongside `teardown`.
  const onExit = () => {
    killStudioWorkerSync();
    for (const runtime of runtimes) {
      stopAppRuntime(runtime, "SIGKILL");
      try {
        runtime.proxy?.close();
      } catch {
        // non-fatal
      }
    }
  };

  devLifecycle = ProcessLifecycle.register({
    scope: "dev",
    onSignal: () => onSignal(),
    onExit,
  });

  if (process.stdout.isTTY && !options.debug) {
    let update: Awaited<ReturnType<typeof checkForUpdate>> = null;
    await withTimeout(
      checkForUpdate().then((info) => {
        update = info;
      }),
      3_000,
    );
    printDevBanner({
      version: cliVersion,
      studioUrl: studio.url,
      targets: runtimes
        .filter(({ app }) => app.proxied)
        .map(({ app }) => ({
          label: app.label,
          url: previewUrl(app.proxyPort),
        })),
      update,
    });
  } else {
    console.log(chalk.cyan(`  Studio  ${studio.url}`));
    console.log(chalk.blue.bold("\nddd\n"));
    for (const { app } of runtimes) {
      if (app.proxied) {
        console.log(`  ${app.label}  ${chalk.dim(previewUrl(app.proxyPort))}`);
      } else {
        console.log(`  ${app.label}  ${chalk.dim("(dev only, no proxy)")}`);
      }
    }
    console.log("");
  }

  if (shouldAutoOpenBrowser(options)) {
    openInBrowser(studio.url);
    console.log(chalk.dim("  Opened Studio in your browser\n"));
  }

  for (const runtime of runtimes) {
    const child = spawnApp(runtime, options);

    child.on("error", (err) => {
      if (tearingDown) return;
      console.error(
        chalk.red(`Failed to start "${runtime.app.label}": ${err.message}`),
      );
      if (!options.isHot) {
        exitClean(1);
      }
    });

    child.on("exit", (code, signal) => {
      if (tearingDown) return;

      // Under hot reload we keep the studio/proxy up and simply wait for the
      // next module reload to restart the dev server, instead of killing the
      // whole process (which would take the studio and proxy down with it).
      if (options.isHot) {
        log.info("dev server exited — waiting for next reload", {
          app: runtime.app.label,
          code,
          signal,
        });
        return;
      }

      // Ctrl+C / SIGTERM often reaches the app child before our handler runs.
      if (signal === "SIGINT" || signal === "SIGTERM") {
        exitClean(0);
        return;
      }

      const failed = code !== 0 && code !== null;
      if (failed) {
        console.error(
          chalk.red(`\n${runtime.app.label} exited with code ${code}.`),
        );
      }
      exitClean(failed ? (code ?? 1) : 0);
    });
  }

  return { teardown };
}
