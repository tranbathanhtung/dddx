import { displayUrl } from "./service-endpoints.ts";

/** Default host when running CLI from source (apps/web dev server). */
export const local = displayUrl(3000);

/** Production SDK CDN base (R2 public URL or custom domain). */
export const production = "https://cdn.dddx.dev";

function useLocalSdk(): boolean {
  if (version() === "local") return true;
  return process.env.NODE_ENV === "development";
}

/** SDK asset base URL (local apps/web or production CDN). */
export function origin(): string {
  return useLocalSdk() ? local : production;
}

/** CLI version baked at build time; `"local"` when running from source. */
export function version(): string {
  return typeof DDDX_VERSION === "string" ? DDDX_VERSION : "local";
}

/** Version-pinned asset URL, e.g. `https://dddx.dev/sdk/0.1.0/index.js`. */
export function asset(path: string): string {
  const base = origin().replace(/\/$/, "");
  const file = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/sdk/${version()}/${file}`;
}

/** SDK origin helpers (plain object for Node `--experimental-strip-types` in proxy worker). */
export const Sdk = {
  local,
  production,
  origin,
  version,
  asset,
};
