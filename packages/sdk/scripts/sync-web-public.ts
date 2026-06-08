/**
 * @deprecated SDK assets are no longer copied to `apps/web/public/sdk/`
 * (large files stall `next build`). Use:
 * - Local: `apps/web` route `/sdk/local/*` → `packages/sdk/dist`
 * - Production: `bun run publish:r2` → Cloudflare R2
 */
import { pushSdk } from "./sdk-r2";

if (import.meta.main) {
  console.warn(
    "sync-web-public is deprecated. Publishing to R2 instead (set R2_* env vars).\n",
  );
  await pushSdk();
}
