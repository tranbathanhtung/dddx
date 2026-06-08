const STUDIO_SLUG_PATH = /^\/p\/([^/]+)(?:\/|$)/;

/** Project slug from the studio URL path (`/p/<slug>`). */
export function studioProjectSlug(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): string {
  const match = pathname.match(STUDIO_SLUG_PATH);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

/** Path for a studio project (same origin). */
export function studioProjectPath(slug: string): string {
  return `/p/${encodeURIComponent(slug)}`;
}

/** Full URL to open another attached project on the same studio origin. */
export function studioProjectUrl(slug: string): string {
  return new URL(studioProjectPath(slug), window.location.origin).href;
}

/** Headers for same-origin studio API calls (tRPC, chat, fetch). */
export function studioApiHeaders(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): Record<string, string> {
  const slug = studioProjectSlug(pathname);
  return slug ? { "x-dddx-project": slug } : {};
}
