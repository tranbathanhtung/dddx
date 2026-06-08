/**
 * Publish the official plugins marketplace to R2.
 *
 *   bun run scripts/publish.ts [--source <dir>]
 *
 * Requires: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { pushOfficial } from "../../cli/src/util/plugin-r2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseSource(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--source" && argv[i + 1]) {
      return path.resolve(argv[i + 1]!);
    }
  }
  return ROOT;
}

const source = parseSource(process.argv.slice(2));
const { version } = await pushOfficial(source);
console.log(
  `✓ Pushed official marketplace v${version} to r2://${process.env.R2_BUCKET}/${process.env.R2_PREFIX ?? "plugins"}/official`,
);
