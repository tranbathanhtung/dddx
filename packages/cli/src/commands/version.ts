import chalk from "chalk";
import type { Command } from "commander";

import { Installation } from "@/util/installation";

const fail = (error: unknown) => {
  console.error(
    chalk.red(error instanceof Error ? error.message : "Command failed"),
  );
  process.exit(1);
};

type UpgradeMethod = Extract<
  Installation.Method,
  "npm" | "pnpm" | "bun" | "yarn" | "curl"
>;

function isUpgradeMethod(method: Installation.Method): method is UpgradeMethod {
  return (
    method === "npm" ||
    method === "pnpm" ||
    method === "bun" ||
    method === "yarn" ||
    method === "curl"
  );
}

export const version = (command: Command) => {
  command
    .command("upgrade")
    .description("Upgrade dddx to the latest or a specific version")
    .argument("[version]", "Target version (default: latest from registry)")
    .action(async (version?: string) => {
      try {
        const target = version ?? (await Installation.latest());

        if (Installation.VERSION === target) {
          console.log(chalk.green(`Already on @dddx/cli@${target}`));
          return;
        }

        const method = await Installation.method();
        if (!isUpgradeMethod(method)) {
          throw new Error(
            `Cannot auto-upgrade via ${method}. Install manually:\n  curl -fsSL ${Installation.installScriptUrl()} | bash\n  npm install -g @dddx/cli@${target}`,
          );
        }

        console.log(
          chalk.cyan(
            `Upgrading @dddx/cli ${Installation.VERSION} → ${target} (${method})…`,
          ),
        );
        await Installation.upgrade(method, target);
        console.log(chalk.green(`✓ Upgraded to @dddx/cli@${target}`));
      } catch (error) {
        fail(error);
      }
    });

  command
    .command("version")
    .alias("v")
    .description("Show the current version")
    .action(() => {
      console.log(Installation.VERSION);
    });
};
