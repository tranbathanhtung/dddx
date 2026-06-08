/** Production site + CDN base (matches `packages/cli/src/util/sdk-origin.ts`). */
export const production = "https://dddx.dev";

/** Public origin for install script + CLI downloads (env override for staging). */
export function publicOrigin(requestOrigin?: string | null): string {
  const fromEnv =
    process.env.DDDX_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_DDDX_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (requestOrigin) return requestOrigin.replace(/\/$/, "");
  return production;
}
