#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";

import { plugin } from "./commands/plugin";
import { version } from "./commands/version";
import { Hot } from "./util/hot";
import { ProcessLifecycle } from "./util/lifecycle";
import { Log } from "./util/log";
import { killStudioWorkerSync } from "./studio/registry";

const importMetaHot = (import.meta as unknown as { hot?: Hot.BunHot }).hot;

// On `bun --hot`, the module re-evaluates in the same process when source
// changes. The slot holds the previous run's teardown so we can stop the dev
// server, proxy, and studio *without* exiting the process before the fresh
// evaluation boots a new run. The shared studio worker stays attached across
// reloads — only dev/proxy children are restarted.
const hot = Hot.register<() => void | Promise<void>>({
  key: "__dddx",
  hot: importMetaHot,
  label: "dddx",
  cleanup: (teardown) => teardown(),
});

ProcessLifecycle.installGlobalFatal({
  label: "dddx",
  isHot: Boolean(importMetaHot),
  beforeExit: async () => {
    killStudioWorkerSync();
    await Hot.emergencyCleanup("__dddx");
  },
});

export const program = new Command();

program
  .name("dddx")
  .description(
    "AI-powered development tools with browser monitoring and tool integrations",
  );

program
  .option("-p, --port <port>", "Development server port (default: 3000)")
  .option(
    "-s, --script <script>",
    "Script to run (e.g. dev, main.py) - auto-detected by project type",
  )
  .option(
    "-c, --command <command>",
    "Custom command to run (overrides auto-detection and --script)",
  )
  .option(
    "--startup-timeout <seconds>",
    "Seconds to wait for your app server to become reachable",
    "30",
  )
  .option("--debug", "Enable debug mode", false)
  .option(
    "--open-browser",
    "Open Studio in the browser on the first project run",
    true,
  )
  .action(async (options) => {
    const { projectType } = await import("./detect");
    const { runDev } = await import("./dev");

    const debug = Boolean(options.debug);
    Log.init({ debug, print: false });
    if (debug) {
      process.env[Log.DEBUG_ENV] = "1";
    }
    const projectConfig = await projectType(debug);

    if (projectConfig.noProjectDetected) {
      console.error(
        chalk.red("\n❌ No project detected in current directory.\n"),
      );
      console.error(
        chalk.white("dddx requires a project with one of these files:"),
      );
      console.error(chalk.gray("  • package.json (Node.js/JavaScript)"));
      console.error(
        chalk.gray("  • requirements.txt or pyproject.toml (Python)"),
      );
      console.error(
        chalk.gray("  • Gemfile + config/application.rb (Rails)\n"),
      );
      console.error(chalk.cyan("💡 To get started:"));
      console.error(
        chalk.gray("  • Navigate to an existing project directory, or"),
      );
      console.error(
        chalk.gray(
          "  • Create a new project (e.g., 'npx create-next-app@latest'), or",
        ),
      );
      console.error(chalk.gray("  • Use --command to run a custom command:\n"));
      console.error(chalk.yellow(`    dddx --command "node server" -p 3000\n`));
      process.exit(1);
    }

    const port = options.port || projectConfig.defaultPort;
    const script = options.script || projectConfig.defaultScript;
    const userSetPort = options.port !== undefined;
    const startupTimeoutSeconds = Number.parseInt(options.startupTimeout, 10);

    if (Number.isNaN(startupTimeoutSeconds) || startupTimeoutSeconds <= 0) {
      console.error(
        chalk.red(
          "\n❌ --startup-timeout must be a positive integer (seconds).\n",
        ),
      );
      process.exit(1);
    }

    try {
      if (importMetaHot) {
        await Hot.awaitPendingCleanup("__dddx");
      }

      const handle = await runDev({
        port,
        script,
        command: options.command,
        debug: options.debug,
        openBrowser: options.openBrowser,
        projectConfig,
        userSetPort,
        isHot: Boolean(importMetaHot),
      });

      hot.set(() => handle.teardown());
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to start development environment:"),
        error,
      );
      process.exit(1);
    }
  });

program
  .command("_studio-worker", { hidden: true })
  .description("Detached studio server (spawned by dddx dev)")
  .action(async () => {
    const { runStudioWorker } = await import("@/studio/worker");
    await runStudioWorker();
  });

const main = async () => {
  plugin(program);
  version(program);
  await program.parseAsync();
};

main().catch((err) => {
  console.error("[dddx] Fatal error:", err);
  void Hot.emergencyCleanup("__dddx").finally(() =>
    ProcessLifecycle.forceExit(1, { isHot: Boolean(importMetaHot) }),
  );
});
