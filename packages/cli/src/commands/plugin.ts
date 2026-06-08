import chalk from "chalk";
import type { Command } from "commander";

import { Plugin } from "@/util/plugin";

const fail = (error: unknown) => {
  console.error(
    chalk.red(error instanceof Error ? error.message : "Plugin command failed"),
  );
  process.exit(1);
};

export const plugin = (command: Command) => {
  const program = command
    .command("plugin")
    .description("Manage local dddx plugins");

  program
    .command("add <source>")
    .description(
      "Add a marketplace from a GitHub link into ~/.dddx/plugins/<id>",
    )
    .option("--name <name>", "Marketplace namespace id")
    .action(async (source, options) => {
      try {
        const result = await Plugin.add({ source, ...options });
        const count = result.marketplace?.pluginCount ?? 0;
        console.log(
          chalk.green(
            `\n✓ Added marketplace "${result.id}" (${count} plugin${count === 1 ? "" : "s"})\n`,
          ),
        );
      } catch (error) {
        fail(error);
      }
    });

  program
    .command("remove <id>")
    .description("Remove an installed marketplace from ~/.dddx/plugins/<id>")
    .action(async (id) => {
      try {
        const result = await Plugin.remove(id);
        if (result.removed) {
          console.log(chalk.green(`\n✓ Removed marketplace "${result.id}"\n`));
        } else {
          console.log(chalk.yellow(`\nMarketplace "${result.id}" not found\n`));
        }
      } catch (error) {
        fail(error);
      }
    });

  program
    .command("index")
    .description("Index plugin.json for a plugin folder or marketplace.json for a collection")
    .option("--dir <dir>", "Plugin or collection folder to index (defaults to cwd)")
    .option("--collection", "Index a collection root and regenerate marketplace.json plugins")
    .option("--id <id>", "Legacy plugin id (maps to display name)")
    .option("--name <name>", "Display name")
    .option("--description <description>", "Short description")
    .option("--source <source>", "Source URL")
    .option(
      "--capture-previews",
      "Screenshot HTML previews to preview.png (requires Playwright)",
    )
    .option(
      "--force-previews",
      "Re-capture preview.png even when it already exists",
    )
    .action(async (options) => {
      try {
        const result = await Plugin.index(options);
        if ("marketplace" in result) {
          console.log(
            chalk.green(
              `\n✓ Indexed marketplace ${result.marketplace.name} (v${result.marketplace.version}, ${result.marketplace.plugins.length} plugins)\n`,
            ),
          );
          return;
        }

        console.log(
          chalk.green(
            `\n✓ Indexed ${result.manifest.name} (${result.manifest.items.length} items)\n`,
          ),
        );
      } catch (error) {
        fail(error);
      }
    });

  program
    .command("validate")
    .description("Check plugin.json manifests and collection marketplace.json")
    .option("--dir <dir>", "Pack folder (defaults to cwd)")
    .action(async (options) => {
      try {
        const issues = await Plugin.validate(options.dir);
        const errors = issues.filter((i) => i.level === "error");
        for (const issue of issues) {
          const label =
            issue.level === "error" ? chalk.red("error") : chalk.yellow("warn");
          console.log(`${label}: ${issue.message}`);
        }
        if (errors.length) {
          console.log(chalk.red(`\n✗ ${errors.length} error(s)\n`));
          process.exit(1);
        }
        console.log(chalk.green("\n✓ Valid\n"));
      } catch (error) {
        fail(error);
      }
    });
};
