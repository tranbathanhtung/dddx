/**
 * Hosts and default ports for dddx-managed services.
 *
 * - LISTEN_HOST: bind address for servers dddx starts (0.0.0.0 = all interfaces).
 * - CONNECT_HOST: loopback used for health checks and proxy → local app upstream.
 * - DISPLAY_HOST: hostname shown in terminal URLs (browser-friendly).
 */

/** Bind address for HTTP servers started by dddx. */
export const LISTEN_HOST = "0.0.0.0";

/** Loopback used for health checks (always IPv4). */
export const CONNECT_HOST = "127.0.0.1";

/** Hostname printed in dev/studio URLs. */
export const DISPLAY_HOST = "localhost";

/**
 * Hostname for proxy → local dev-server upstream. Use "localhost" (not
 * 127.0.0.1) so we reach apps that bind to ::1, which is common when a
 * framework is started with `--host localhost`.
 */
export const UPSTREAM_HOST = DISPLAY_HOST;

export const LOCAL_DEV_HOSTNAMES = ["localhost", "127.0.0.1"] as const;

/** Shared studio worker port. Override with `DDDX_STUDIO_PORT`. */
export const DEFAULT_STUDIO_PORT = 4723;

/** Unprivileged fallback when the default portless proxy port is taken. */
export const FALLBACK_PROXY_PORT = 1355;

export function resolveStudioPort(): number {
  const parsed = Number.parseInt(process.env.DDDX_STUDIO_PORT ?? "", 10);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  return DEFAULT_STUDIO_PORT;
}

export function connectUrl(port: number, path = ""): string {
  const normalized = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `http://${CONNECT_HOST}:${port}${normalized}`;
}

export function displayUrl(port: number, path = ""): string {
  const normalized = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `http://${DISPLAY_HOST}:${port}${normalized}`;
}

/** True for loopback and common LAN hostnames when LISTEN_HOST is 0.0.0.0. */
export function isLocalDevHostname(hostname: string): boolean {
  if ((LOCAL_DEV_HOSTNAMES as readonly string[]).includes(hostname)) {
    return true;
  }
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);
}

/** Inline `location.hostname` guard for injected browser scripts. */
export function localDevHostnameCheckJs(): string {
  return `(function(h){const a=${JSON.stringify(LOCAL_DEV_HOSTNAMES)};return a.includes(h)||/^(10\\.|172\\.(1[6-9]|2\\d|3[01])\\.|192\\.168\\.)/.test(h)})(location.hostname)`;
}
