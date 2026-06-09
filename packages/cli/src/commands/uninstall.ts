import chalk from "chalk";
import type { Command } from "commander";

import { Installation } from "@/util/installation";

const fail = (error: unknown) => {
  console.error(
    chalk.red(error instanceof Error ? error.message : "Uninstall failed"),
  );
  process.exit(1);
};

export const uninstall = (command: Command) => {
  command
    .command("uninstall")
    .description("Uninstall dddx from your system")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (options) => {
      try {
        const method = await Installation.method();

        if (method === "unknown") {
          console.error(
            chalk.yellow(
              "\n⚠ Could not detect how dddx was installed. Remove it manually:\n",
            ),
          );
          console.error(chalk.gray("  npm:  npm uninstall -g @dddx/cli"));
          console.error(chalk.gray("  pnpm: pnpm remove -g @dddx/cli"));
          console.error(chalk.gray("  bun:  bun remove -g @dddx/cli"));
          console.error(chalk.gray("  yarn: yarn global remove @dddx/cli"));
          console.error(
            chalk.gray(
              "  curl: rm ~/.dddx/bin/dddx  (or ~/.local/bin/dddx)\n",
            ),
          );
          process.exit(1);
        }

        if (!options.yes) {
          const { createInterface } = await import("node:readline");
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const confirmed = await new Promise<boolean>((resolve) => {
            rl.question(
              chalk.yellow(
                `\nUninstall @dddx/cli (installed via ${method})? [y/N] `,
              ),
              (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === "y");
              },
            );
          });

          if (!confirmed) {
            console.log(chalk.gray("\nAborted.\n"));
            return;
          }
        }

        console.log(
          chalk.cyan(`\nUninstalling @dddx/cli (via ${method})…`),
        );
        await Installation.uninstall(method);
        console.log(chalk.green("✓ Removed @dddx/cli package"));
        console.log(chalk.green("✓ Removed ~/.dddx\n"));
      } catch (error) {
        fail(error);
      }
    });
};
