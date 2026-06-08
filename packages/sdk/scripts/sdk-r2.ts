/**
 * Publish SDK bundles to Cloudflare R2.
 *
 *   bun run scripts/sdk-r2.ts push [--version <ver>]
 *
 * Requires: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *           R2_PUBLIC_BASE_URL or R2_PUBLIC_BASE_URL (for logged public URLs)
 */

import { putR2Object, requireR2Client, r2PublicBaseUrl } from "@dddx/r2";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCliVersion } from "./cli-version";

const SDK_R2_PREFIX = process.env.SDK_R2_PREFIX?.trim() || "sdk";

const sdkRoot = join(import.meta.dir, "..");
const distDir = join(sdkRoot, "dist");
const assets = ["index.js", "studio.js", "devtools.js"] as const;

const CONTENT_TYPES: Record<(typeof assets)[number], string> = {
  "index.js": "application/javascript; charset=utf-8",
  "studio.js": "application/javascript; charset=utf-8",
  "devtools.js": "application/javascript; charset=utf-8",
};

function sdkObjectKey(version: string, file: string): string {
  return `${SDK_R2_PREFIX}/${version}/${file}`;
}

function sdkR2PublicBase(): string {
  return r2PublicBaseUrl(["R2_PUBLIC_BASE_URL"], {
    required: true,
  });
}

type Args = { _: string[]; [flag: string]: string | boolean | string[] };

function parseArgs(argv: string[]): Args {
  const args: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Upload `dist/*.js` to R2 at `sdk/{version}/` (production CDN). */
export async function pushSdk(version?: string): Promise<string> {
  const v = version ?? (await getCliVersion());
  const { client, bucket } = requireR2Client();
  const publicBase = sdkR2PublicBase();

  for (const file of assets) {
    const src = join(distDir, file);
    if (!(await exists(src))) {
      throw new Error(
        `Missing ${src}. Run \`bun run build\` in packages/sdk first.`,
      );
    }
    const key = sdkObjectKey(v, file);
    await putR2Object(
      client,
      bucket,
      key,
      await readFile(src),
      CONTENT_TYPES[file],
    );
    console.log(`✓ ${key}`);
  }

  console.log(`\nPublic URLs (base ${publicBase}):`);
  for (const file of assets) {
    console.log(`  ${publicBase}/sdk/${v}/${file}`);
  }

  return v;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

if (import.meta.main) {
  if (command === "push") {
    const version = typeof args.version === "string" ? args.version : undefined;
    const v = await pushSdk(version);
    console.log(`\nPublished @dddx/sdk@${v} to R2.`);
  } else {
    console.error("Usage: bun run scripts/sdk-r2.ts push [--version <ver>]");
    process.exit(1);
  }
}
