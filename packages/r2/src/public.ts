/** Public HTTPS base for an R2 bucket, e.g. `https://<account>.r2.cloudflarestorage.com/<bucket>`. */
export function r2PublicBaseUrl(
  envKeys: string[],
  options?: { defaultUrl?: string; required?: boolean },
): string {
  for (const key of envKeys) {
    const raw = process.env[key]?.trim();
    if (raw) return raw.replace(/\/$/, "");
  }

  const fallback = options?.defaultUrl?.trim();
  if (fallback) return fallback.replace(/\/$/, "");

  if (options?.required) {
    throw new Error(
      `Set ${envKeys.join(" or ")} (public bucket base, no trailing slash).`,
    );
  }

  return "";
}

export function r2PublicObjectUrl(publicBase: string, key: string): string {
  const base = publicBase.replace(/\/$/, "");
  const path = key.startsWith("/") ? key.slice(1) : key;
  return `${base}/${path}`;
}
