import chalk from "chalk";

import { Installation } from "@/util/installation";

export type DevBannerTarget = {
  label: string;
  url: string;
};

export type DevBannerOptions = {
  version: string;
  studioUrl: string;
  targets: DevBannerTarget[];
  update?: UpdateBannerInfo | null;
};

export type UpdateBannerInfo = {
  current: string;
  latest: string;
};

const brand = chalk.hex("#38BDF8");
const yellow = chalk.hex("#CA8A04");

/** Strip ANSI for width calculation only. */
function visibleLength(text: string): number {
  return text.replace(/\u001b\[[0-9;]*m/g, "").length;
}

type BoxLine = {
  text: string;
  align?: "left" | "center";
};

function drawBox(lines: BoxLine[]): string {
  const innerWidth = Math.max(
    40,
    ...lines.map((line) => visibleLength(line.text)),
  );
  const horizontal = "─".repeat(innerWidth + 2);
  const out: string[] = [
    yellow(`╭${horizontal}╮`),
    ...lines.map(({ text, align = "left" }) => {
      const pad = innerWidth - visibleLength(text);
      const leftPad = align === "center" ? Math.floor(pad / 2) : 0;
      const rightPad = pad - leftPad;
      return (
        yellow("│ ") +
        " ".repeat(leftPad) +
        text +
        " ".repeat(rightPad) +
        yellow(" │")
      );
    }),
    yellow(`╰${horizontal}╯`),
  ];
  return out.join("\n");
}

export async function checkForUpdate(): Promise<UpdateBannerInfo | null> {
  if (Installation.isLocal() || Installation.isPreview()) return null;

  try {
    const latest = await Installation.latest();
    if (!Installation.isOutdated(Installation.VERSION, latest)) return null;

    return {
      current: Installation.VERSION,
      latest,
    };
  } catch {
    return null;
  }
}

/** Turborepo-style boxed banner; sync write so it cannot block the event loop. */
export function printDevBanner(options: DevBannerOptions): void {
  const lines: BoxLine[] = [
    { text: brand.bold("dddx") + chalk.dim(` v${options.version}`) },
    { text: "" },
    {
      text:
        chalk.white("Studio") +
        chalk.dim("  ") +
        chalk.cyan(options.studioUrl),
    },
  ];

  for (const { label, url } of options.targets) {
    lines.push({
      text: chalk.white(label) + chalk.dim("  ") + chalk.cyan(url),
    });
  }

  if (options.update) {
    lines.push(
      { text: "" },
      {
        text:
          chalk.white(`Update available ${options.update.current} → `) +
          chalk.green(options.update.latest),
        align: "center",
      },
      {
        text:
          chalk.white("Run ") +
          chalk.cyan("dddx upgrade") +
          chalk.white(" to update"),
        align: "center",
      },
    );
  }

  const box = drawBox(lines);
  process.stderr.write(`\n${box}\n\n`);
}
