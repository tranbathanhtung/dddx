import type { Command } from "commander";

function findCommand(root: Command, parts: string[]): Command | undefined {
  let current = root;
  for (const part of parts) {
    const next = current.commands.find(
      (cmd) => cmd.name() === part || cmd.aliases().includes(part),
    );
    if (!next) return undefined;
    current = next;
  }
  return current;
}

export const help = (root: Command) => {
  root
    .command("help")
    .description("Show help for dddx or a subcommand")
    .argument("[command...]", "Command path (e.g. plugin add)")
    .allowExcessArguments()
    .action((commandParts: string[]) => {
      const parts = commandParts.filter(Boolean);
      if (parts.length === 0) {
        root.outputHelp();
        return;
      }

      const target = findCommand(root, parts);
      if (!target) {
        console.error(`Unknown command: ${parts.join(" ")}`);
        console.error("Run `dddx help` for usage.");
        process.exit(1);
      }

      target.outputHelp();
    });
};
