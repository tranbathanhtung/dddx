import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ASSETS = new Set(["index.js", "studio.js", "devtools.js"]);

/** Monorepo SDK build output — never copy multi‑MB bundles into `public/`. */
const SDK_DIST = path.join(process.cwd(), "../../packages/sdk/dist");

async function resolveAsset(
  version: string,
  file: string,
): Promise<{ bytes: Uint8Array; cache: string } | null> {
  const distPath = path.join(SDK_DIST, file);
  try {
    await access(distPath);
    const bytes = new Uint8Array(await readFile(distPath));
    const cache =
      process.env.NODE_ENV === "development" || version === "local"
        ? "no-store"
        : "public, max-age=31536000, immutable";
    return { bytes, cache };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ version: string; file: string }> },
) {
  const { version, file } = await context.params;
  if (!ASSETS.has(file)) {
    return new Response("Not found", { status: 404 });
  }

  const asset = await resolveAsset(version, file);
  if (!asset) {
    return new Response(
      "SDK bundle missing. From repo root: cd packages/sdk && bun run build",
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  return new Response(asset.bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Cache-Control": asset.cache,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    },
  });
}
