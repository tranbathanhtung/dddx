import * as http from "node:http";
import * as http2 from "node:http2";
import * as net from "node:net";
import * as fs from "node:fs";
import { injectDevtoolsHtml } from "../src/util/devtools-inject.ts";
import {
  DISPLAY_HOST,
  UPSTREAM_HOST,
} from "../src/util/service-endpoints.ts";

const GEIST_SANS_400 = "";
const GEIST_SANS_500 = "";
const GEIST_MONO_400 = "";
const GEIST_PIXEL = "";

export const ARROW_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 3.5L11 8l-4.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const PAGE_STYLES = `
  @font-face {
    font-family: 'Geist';
    src: url('${GEIST_SANS_400}') format('woff2');
    font-weight: 400;
    font-display: swap;
  }
  @font-face {
    font-family: 'Geist';
    src: url('${GEIST_SANS_500}') format('woff2');
    font-weight: 500;
    font-display: swap;
  }
  @font-face {
    font-family: 'Geist Mono';
    src: url('${GEIST_MONO_400}') format('woff2');
    font-weight: 400;
    font-display: swap;
  }
  @font-face {
    font-family: 'Geist Pixel';
    src: url('${GEIST_PIXEL}') format('woff2');
    font-weight: 400;
    font-display: swap;
  }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #fff;
    --fg: #171717;
    --border: #eaeaea;
    --surface: #fafafa;
    --text-2: #666;
    --text-3: #a1a1a1;
    --accent: #0070f3;
    --font-sans: 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'Geist Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #000;
      --fg: #ededed;
      --border: rgba(255,255,255,0.1);
      --surface: #111;
      --text-2: #888;
      --text-3: #666;
      --accent: #3291ff;
    }
  }
  html { height: 100%; }
  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--fg);
    min-height: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .hero h1 {
    font-family: 'Geist Pixel', var(--font-mono);
    font-size: clamp(80px, 15vw, 144px);
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.04em;
    color: var(--fg);
  }
  .hero h2 {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-3);
    margin-top: 16px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }
  .content {
    margin-top: 56px;
    width: 100%;
    max-width: 480px;
  }
  .desc {
    font-size: 14px;
    color: var(--text-2);
    text-align: center;
    line-height: 1.7;
  }
  .desc strong {
    color: var(--fg);
    font-weight: 500;
  }
  .section { margin-top: 32px; }
  .label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 10px;
  }
  .card {
    list-style: none;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .card > li {
    border-bottom: 1px solid var(--border);
  }
  .card > li:last-child { border-bottom: none; }
  .card-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    text-decoration: none;
    color: inherit;
    transition: background 0.15s ease;
  }
  .card-link:hover { background: var(--surface); }
  .card-link .name {
    font-size: 14px;
    font-weight: 500;
    transition: color 0.15s ease;
  }
  .card-link:hover .name { color: var(--accent); }
  .card-link .meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-link .port {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-3);
  }
  .card-link .arrow {
    color: var(--text-3);
    display: flex;
    transition: transform 0.2s ease, color 0.2s ease;
  }
  .card-link:hover .arrow {
    transform: translateX(2px);
    color: var(--text-2);
  }
  .terminal {
    font-family: var(--font-mono);
    font-size: 13px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 20px;
    line-height: 1.7;
    color: var(--fg);
  }
  .terminal .prompt {
    color: var(--text-3);
    user-select: none;
  }
  pre.terminal { white-space: pre-wrap; }
  .empty {
    font-size: 14px;
    color: var(--text-3);
    text-align: center;
    padding: 32px 0;
  }
  .footer {
    margin-top: 64px;
    font-size: 11px;
    color: var(--text-3);
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
  }
`;

export function renderPage(
  status: number,
  statusText: string,
  body: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${status} - ${statusText}</title>
<style>${PAGE_STYLES}</style>
</head>
<body>
<div class="page">
<div class="hero"><h1>${status}</h1><h2>${statusText}</h2></div>
${body}
<p class="footer">portless</p>
</div>
</body>
</html>`;
}

/**
 * When running under sudo, fix file ownership so the real user can
 * read/write the file later without sudo. No-op on Windows or when not
 * running as root.
 */
export function fixOwnership(...paths: string[]): void {
  if (process.platform === "win32") return;
  const uid = process.env.SUDO_UID;
  const gid = process.env.SUDO_GID;
  if (!uid || process.getuid?.() !== 0) return;
  for (const p of paths) {
    try {
      const stat = fs.lstatSync(p);
      if (stat.isSymbolicLink()) continue;
      fs.chownSync(p, parseInt(uid, 10), parseInt(gid || uid, 10));
    } catch {
      // Best-effort
    }
  }
}

/** Type guard for Node.js system errors with an error code. */
export function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format a URL for the given hostname. Omits the port when it matches the
 * protocol default (80 for HTTP, 443 for HTTPS).
 */
export function formatUrl(
  hostname: string,
  proxyPort: number,
  tls = false,
): string {
  const proto = tls ? "https" : "http";
  const defaultPort = tls ? 443 : 80;
  return proxyPort === defaultPort
    ? `${proto}://${hostname}`
    : `${proto}://${hostname}:${proxyPort}`;
}

/**
 * Parse and normalize a hostname input for use as a subdomain of the
 * configured TLD. Strips protocol prefixes, validates characters, and
 * appends the TLD suffix if needed.
 */
export function parseHostname(input: string, tld = "localhost"): string {
  const suffix = `.${tld}`;

  // Remove any protocol prefix
  let hostname = input
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .toLowerCase();

  // Backward compat: strip default .localhost suffix when switching to a custom TLD
  if (tld !== "localhost" && hostname.endsWith(".localhost")) {
    hostname = hostname.slice(0, -".localhost".length);
  }

  // Validate non-empty
  if (!hostname || hostname === suffix) {
    throw new Error("Hostname cannot be empty");
  }

  // Add TLD suffix if not present
  if (!hostname.endsWith(suffix)) {
    hostname = `${hostname}${suffix}`;
  }

  // Validate hostname characters (letters, digits, hyphens, dots)
  const name = hostname.slice(0, -suffix.length);
  if (name.includes("..")) {
    throw new Error(
      `Invalid hostname "${name}": consecutive dots are not allowed`,
    );
  }
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(name)) {
    throw new Error(
      `Invalid hostname "${name}": must contain only lowercase letters, digits, hyphens, and dots`,
    );
  }

  // Validate per-label length (RFC 1035: max 63 characters per label)
  const labels = name.split(".");
  for (const label of labels) {
    if (label.length > 63) {
      throw new Error(
        `Invalid hostname "${name}": label "${label}" exceeds 63-character DNS limit`,
      );
    }
  }

  return hostname;
}

/** Route info used by the proxy server to map hostnames to ports. */
export interface RouteInfo {
  hostname: string;
  port: number;
}

export interface ProxyServerOptions {
  mode?: "host" | "port";
  /** Called on each request to get the current route table. */
  getRoutes: () => RouteInfo[];
  /** The port the proxy is listening on (used to build correct URLs). */
  proxyPort: number;
  /** TLD suffix used for hostnames (default: "localhost"). */
  tld?: string;
  /**
   * When true, only exact hostname matches are used. Unregistered subdomain
   * prefixes return 404 instead of falling back to the base service.
   * Defaults to true.
   */
  strict?: boolean;
  /** Optional error logger; defaults to console.error. */
  onError?: (message: string) => void;
  /** When provided, enables HTTP/2 over TLS (HTTPS). */
  tls?: {
    cert: Buffer;
    key: Buffer;
    /** CA certificate to include in the chain so clients can verify the leaf. */
    ca?: Buffer;
    /** SNI callback for per-hostname certificate selection. */
    SNICallback?: (
      servername: string,
      cb: (err: Error | null, ctx?: import("node:tls").SecureContext) => void,
    ) => void;
  };
}

/** Response header used to identify a portless proxy (for health checks). */
export const PORTLESS_HEADER = "X-Portless";

/**
 * HTTP/1.1 hop-by-hop headers that are forbidden in HTTP/2 responses.
 * These must be stripped when proxying an HTTP/1.1 backend response
 * back to an HTTP/2 client.
 */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
]);

/**
 * Get the effective host value from a request.
 * HTTP/2 uses the :authority pseudo-header; HTTP/1.1 uses Host.
 */
function getRequestHost(req: http.IncomingMessage): string {
  // HTTP/2 :authority pseudo-header (available via compatibility API)
  const authority = req.headers[":authority"];
  if (typeof authority === "string" && authority) return authority;
  return req.headers.host || "";
}

/** Write a raw HTTP/1.1 upgrade request over a connected TCP socket. */
function writeRawUpgradeRequest(
  socket: net.Socket,
  req: http.IncomingMessage,
  headers: http.OutgoingHttpHeaders,
  head: Buffer,
): void {
  const lines = [`${req.method || "GET"} ${req.url || "/"} HTTP/1.1`];
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    lines.push(
      `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
    );
  }
  lines.push("", "");
  socket.write(lines.join("\r\n"));
  if (head.length > 0) socket.write(head);
}

/** Bidirectionally relay a proxied WebSocket after the backend 101 headers. */
function relayWebSocket(
  clientSocket: net.Socket,
  proxySocket: net.Socket,
): void {
  const cleanup = () => {
    proxySocket.destroy();
    clientSocket.destroy();
  };
  proxySocket.on("error", cleanup);
  clientSocket.on("error", cleanup);
  proxySocket.on("close", cleanup);
  clientSocket.on("close", cleanup);
  proxySocket.on("end", cleanup);
  clientSocket.on("end", cleanup);
  proxySocket.pipe(clientSocket);
  clientSocket.pipe(proxySocket);
}

function isBenignProxyError(err: Error): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  const message = err.message.toLowerCase();
  return (
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ECANCELED" ||
    message.includes("socket hang up") ||
    message.includes("aborted")
  );
}

/**
 * Detect whether a request arrived over an encrypted (TLS) connection.
 * Works for both native TLS sockets and HTTP/2 streams.
 */
function isEncrypted(req: http.IncomingMessage): boolean {
  return !!(req.socket as net.Socket & { encrypted?: boolean }).encrypted;
}

/**
 * Build X-Forwarded-* headers for a proxied request.
 */
function buildForwardedHeaders(
  req: http.IncomingMessage,
  tls: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const remoteAddress = req.socket.remoteAddress || "127.0.0.1";
  const proto = tls ? "https" : "http";
  const defaultPort = tls ? "443" : "80";
  const hostHeader = getRequestHost(req);

  headers["x-forwarded-for"] = req.headers["x-forwarded-for"]
    ? `${req.headers["x-forwarded-for"]}, ${remoteAddress}`
    : remoteAddress;
  headers["x-forwarded-proto"] =
    (req.headers["x-forwarded-proto"] as string) || proto;
  headers["x-forwarded-host"] =
    (req.headers["x-forwarded-host"] as string) || hostHeader;
  headers["x-forwarded-port"] =
    (req.headers["x-forwarded-port"] as string) ||
    hostHeader.split(":")[1] ||
    defaultPort;

  return headers;
}

/**
 * Request header tracking how many times a request has passed through a
 * portless proxy. Used to detect forwarding loops (e.g. a frontend dev
 * server proxying back through portless without rewriting the Host header).
 */
const PORTLESS_HOPS_HEADER = "x-portless-hops";

/**
 * Maximum number of times a request may pass through the portless proxy
 * before it is rejected as a loop. Two hops is normal when a frontend
 * proxies API calls to a separate portless-managed backend; five gives
 * comfortable headroom for multi-tier setups while catching loops quickly.
 */
const MAX_PROXY_HOPS = 5;

/**
 * Find the route matching a given host. Matches exact hostname first, then
 * falls back to wildcard subdomain matching (e.g. tenant.myapp.localhost
 * matches a route registered for myapp.localhost).
 *
 * When `strict` is true, only exact matches are returned; unregistered
 * subdomain prefixes will not fall back to the base service.
 */
function findRoute(
  routes: { hostname: string; port: number }[],
  host: string,
  strict?: boolean,
): { hostname: string; port: number } | undefined {
  return (
    routes.find((r) => r.hostname === host) ||
    (strict ? undefined : routes.find((r) => host.endsWith("." + r.hostname)))
  );
}

/** Server type returned by createProxyServer (plain HTTP/1.1 or net.Server TLS wrapper). */
export type ProxyServer = http.Server | net.Server;

/**
 * Create an HTTP proxy server that routes requests based on the Host header.
 *
 * Uses Node's built-in http module for proxying (no external dependencies).
 * The `getRoutes` callback is invoked on every request so callers can provide
 * either a static list or a live-updating one.
 *
 * When `tls` is provided, creates an HTTP/2 secure server with HTTP/1.1
 * fallback (`allowHTTP1: true`). This enables HTTP/2 multiplexing for
 * browsers while keeping WebSocket upgrades working over HTTP/1.1.
 */
export function createProxyServer(options: ProxyServerOptions): ProxyServer {
  const {
    mode = "host",
    getRoutes,
    proxyPort,
    tld = "localhost",
    strict = true,
    // onError = (msg: string) => console.error(msg),
    onError = (msg: string) => {},
    tls,
  } = options;
  const tldSuffix = `.${tld}`;

  const handleRequest = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => {
    const reqTls = isEncrypted(req);
    res.setHeader(PORTLESS_HEADER, "1");

    const routes = getRoutes();
    const host = getRequestHost(req).split(":")[0];

    if (!host) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing Host header");
      return;
    }

    const hops = parseInt(req.headers[PORTLESS_HOPS_HEADER] as string, 10) || 0;
    if (hops >= MAX_PROXY_HOPS) {
      onError(
        `Loop detected for ${host}: request has passed through portless ${hops} times. ` +
          `This usually means a backend is proxying back through portless without rewriting ` +
          `the Host header. If you use Vite/webpack proxy, set changeOrigin: true.`,
      );
      res.writeHead(508, { "Content-Type": "text/html" });
      res.end(
        renderPage(
          508,
          "Loop Detected",
          `<div class="content"><p class="desc">This request has passed through portless ${hops} times. This usually means a dev server (Vite, webpack, etc.) is proxying requests back through portless without rewriting the Host header.</p><div class="section"><p class="label">Fix: add changeOrigin to your proxy config</p><pre class="terminal">proxy: {
  "/api": {
    target: "${reqTls ? "https" : "http"}://&lt;backend&gt;${escapeHtml(tldSuffix)}${reqTls ? "" : ":&lt;port&gt;"}",
    changeOrigin: true,
  },
}</pre></div></div>`,
        ),
      );
      return;
    }

    const route = mode === "host" ? findRoute(routes, host, strict) : routes[0];

    if (!route) {
      const safeHost = escapeHtml(host);
      const strippedHost = host.endsWith(tldSuffix)
        ? host.slice(0, -tldSuffix.length)
        : host;
      const safeSuggestion = escapeHtml(strippedHost);
      const routesList =
        routes.length > 0
          ? `<div class="section"><p class="label">Active apps</p><ul class="card">${routes.map((r) => `<li><a href="${escapeHtml(formatUrl(r.hostname, proxyPort, reqTls))}" class="card-link"><span class="name">${escapeHtml(r.hostname)}</span><span class="meta"><code class="port">${escapeHtml(DISPLAY_HOST)}:${escapeHtml(String(r.port))}</code><span class="arrow">${ARROW_SVG}</span></span></a></li>`).join("")}</ul></div>`
          : '<p class="empty">No apps running.</p>';
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(
        renderPage(
          404,
          "Not Found",
          `<div class="content"><p class="desc">No app registered for <strong>${safeHost}</strong></p>${routesList}<div class="section"><div class="terminal"><span class="prompt">$ </span>portless ${safeSuggestion} your-command</div></div></div>`,
        ),
      );
      return;
    }

    const forwardedHeaders = buildForwardedHeaders(req, reqTls);
    const proxyReqHeaders: http.OutgoingHttpHeaders = { ...req.headers };
    for (const [key, value] of Object.entries(forwardedHeaders)) {
      proxyReqHeaders[key] = value;
    }
    proxyReqHeaders[PORTLESS_HOPS_HEADER] = String(hops + 1);
    // Keep HTML uncompressed so we can inject a tiny dev script.
    proxyReqHeaders["accept-encoding"] = "identity";
    // Remove HTTP/2 pseudo-headers before forwarding to HTTP/1.1 backend
    for (const key of Object.keys(proxyReqHeaders)) {
      if (key.startsWith(":")) {
        delete proxyReqHeaders[key];
      }
    }

    const proxyReq = http.request(
      {
        hostname: UPSTREAM_HOST,
        port: route.port,
        path: req.url,
        method: req.method,
        headers: proxyReqHeaders,
      },
      (proxyRes) => {
        const responseHeaders: http.OutgoingHttpHeaders = {
          ...proxyRes.headers,
        };
        const contentTypeHeader = proxyRes.headers["content-type"];

        if (reqTls) {
          for (const h of HOP_BY_HOP_HEADERS) {
            delete responseHeaders[h];
          }
        }
        proxyRes.on("error", () => {
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end();
          } else {
            // Headers already sent (mid-stream): destroy instead of end to
            // send RST_STREAM. Calling res.end() here can cause a
            // content-length mismatch that Chrome treats as a session error.
            res.destroy();
          }
        });

        const contentType = Array.isArray(contentTypeHeader)
          ? contentTypeHeader[0] || ""
          : contentTypeHeader || "";
        const shouldInjectDevScript =
          req.method === "GET" &&
          (proxyRes.statusCode || 200) < 300 &&
          contentType.includes("text/html");

        if (shouldInjectDevScript) {
          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          proxyRes.on("end", () => {
            const injected = injectDevtoolsHtml(
              Buffer.concat(chunks).toString("utf8"),
            );

            delete responseHeaders["content-length"];
            res.writeHead(proxyRes.statusCode || 502, responseHeaders);
            res.end(injected);
          });
          return;
        }

        res.writeHead(proxyRes.statusCode || 502, responseHeaders);
        proxyRes.pipe(res);
      },
    );

    let clientClosed = false;

    proxyReq.on("error", (err) => {
      if (clientClosed || isBenignProxyError(err)) return;
      onError(`Proxy error for ${getRequestHost(req)}: ${err.message}`);
      if (!res.headersSent) {
        const errWithCode = err as NodeJS.ErrnoException;
        const detail =
          errWithCode.code === "ECONNREFUSED"
            ? "The target app is not responding. It may have crashed."
            : "The target app may not be running.";
        res.writeHead(502, { "Content-Type": "text/html" });
        res.end(
          renderPage(
            502,
            "Bad Gateway",
            `<div class="content"><p class="desc">${escapeHtml(detail)}</p></div>`,
          ),
        );
      }
    });

    // Abort the outgoing request if the client disconnects
    res.on("close", () => {
      clientClosed = true;
      if (!proxyReq.destroyed) {
        proxyReq.destroy();
      }
    });

    req.on("error", () => {
      if (!proxyReq.destroyed) {
        proxyReq.destroy();
      }
    });

    req.pipe(proxyReq);
  };

  const handleUpgrade = (
    req: http.IncomingMessage,
    socket: net.Socket,
    head: Buffer,
  ) => {
    socket.on("error", () => socket.destroy());

    const hops = parseInt(req.headers[PORTLESS_HOPS_HEADER] as string, 10) || 0;
    if (hops >= MAX_PROXY_HOPS) {
      const host = getRequestHost(req).split(":")[0];
      onError(
        `WebSocket loop detected for ${host}: request has passed through portless ${hops} times. ` +
          `Set changeOrigin: true in your proxy config.`,
      );
      socket.end(
        "HTTP/1.1 508 Loop Detected\r\n" +
          "Content-Type: text/plain\r\n" +
          "\r\n" +
          "Loop Detected: request has passed through portless too many times.\n" +
          "Add changeOrigin: true to your dev server proxy config.\n",
      );
      return;
    }

    const routes = getRoutes();
    const host = getRequestHost(req).split(":")[0]!;
    const route = mode === "host" ? findRoute(routes, host, strict) : routes[0];

    if (!route) {
      socket.destroy();
      return;
    }

    const forwardedHeaders = buildForwardedHeaders(req, isEncrypted(req));
    const proxyReqHeaders: http.OutgoingHttpHeaders = { ...req.headers };
    for (const [key, value] of Object.entries(forwardedHeaders)) {
      proxyReqHeaders[key] = value;
    }
    proxyReqHeaders[PORTLESS_HOPS_HEADER] = String(hops + 1);
    // Remove HTTP/2 pseudo-headers before forwarding to HTTP/1.1 backend
    for (const key of Object.keys(proxyReqHeaders)) {
      if (key.startsWith(":")) {
        delete proxyReqHeaders[key];
      }
    }

    let clientClosed = false;
    socket.on("close", () => {
      clientClosed = true;
    });

    // Use a raw TCP socket instead of http.request() for the upstream upgrade.
    // Bun's Node-compat layer does not reliably emit the 'upgrade' event on
    // outgoing http.request calls, which leaves browser HMR sockets pending.
    const proxySocket = net.connect(
      { host: UPSTREAM_HOST, port: route.port },
      () => {
        writeRawUpgradeRequest(proxySocket, req, proxyReqHeaders, head);
      },
    );

    let responseBuffer = Buffer.alloc(0);
    let relayStarted = false;

    const onProxyData = (chunk: Buffer) => {
      if (relayStarted) return;
      responseBuffer = Buffer.concat([responseBuffer, chunk]);
      const headerEnd = responseBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;

      relayStarted = true;
      proxySocket.off("data", onProxyData);

      const headerBytes = responseBuffer.subarray(0, headerEnd + 4);
      const remainder = responseBuffer.subarray(headerEnd + 4);
      if (!socket.destroyed) {
        socket.write(headerBytes);
        if (remainder.length > 0) socket.write(remainder);
      }
      relayWebSocket(socket, proxySocket);
    };

    proxySocket.on("data", onProxyData);

    proxySocket.on("error", (err) => {
      if (clientClosed || isBenignProxyError(err)) {
        if (!socket.destroyed) socket.destroy();
        return;
      }
      onError(
        `WebSocket proxy error for ${getRequestHost(req)}: ${err.message}`,
      );
      socket.destroy();
    });

    socket.on("close", () => {
      if (!proxySocket.destroyed) proxySocket.destroy();
    });
  };

  if (tls) {
    const h2Server = http2.createSecureServer({
      cert: tls.ca ? Buffer.concat([tls.cert, tls.ca]) : tls.cert,
      key: tls.key,
      allowHTTP1: true,
      // Tolerate high rates of RST_STREAM from browsers during HMR and
      // page navigations. Without this, Node sends GOAWAY INTERNAL_ERROR
      // after ~1000 cumulative stream resets and kills the session,
      // surfacing as ERR_HTTP2_PROTOCOL_ERROR in Chrome. Available in
      // Node 22.11+; silently ignored on older versions.
      ...({ streamResetBurst: 10000, streamResetRate: 100 } as Record<
        string,
        unknown
      >),
      ...(tls.SNICallback ? { SNICallback: tls.SNICallback } : {}),
    });

    // Absorb session-level errors (connection resets, protocol errors from
    // abrupt client disconnects) so they don't crash the proxy.
    h2Server.on("sessionError", () => {});

    // With allowHTTP1, the 'request' event receives objects compatible with
    // http.IncomingMessage / http.ServerResponse. Cast explicitly to satisfy TypeScript.
    h2Server.on(
      "request",
      (req: http2.Http2ServerRequest, res: http2.Http2ServerResponse) => {
        // Absorb RST_STREAM errors from cancelled requests (browser navigation,
        // HMR) so they don't propagate to the HTTP/2 session.
        req.stream?.on("error", () => {});
        handleRequest(
          req as unknown as http.IncomingMessage,
          res as unknown as http.ServerResponse,
        );
      },
    );
    // WebSocket upgrades arrive over HTTP/1.1 connections (allowHTTP1)
    h2Server.on(
      "upgrade",
      (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
        handleUpgrade(req, socket, head);
      },
    );

    // Plain HTTP on a TLS-enabled port -> 302 redirect to HTTPS.
    // The redirect targets the same port because the wrapper net.Server
    // demuxes TLS and plain HTTP on a single listener (peek at first byte).
    const plainServer = http.createServer((req, res) => {
      const host = getRequestHost(req).split(":")[0] || "localhost";
      const location = `https://${host}${proxyPort === 443 ? "" : `:${proxyPort}`}${req.url || "/"}`;
      res.writeHead(302, { Location: location, [PORTLESS_HEADER]: "1" });
      res.end();
    });
    plainServer.on(
      "upgrade",
      (req: http.IncomingMessage, socket: net.Socket) => {
        const host = getRequestHost(req);
        console.warn(
          `[portless] Dropped plain-HTTP WebSocket upgrade for ${host}; use wss:// instead`,
        );
        socket.destroy();
      },
    );

    // Wrap both in a net.Server that peeks at the first byte to decide
    // whether the connection is TLS (0x16 = ClientHello) or plain HTTP.
    const wrapper = net.createServer((socket) => {
      // Absorb connection errors (ECONNRESET, EPIPE, etc.) from abrupt
      // client disconnects (tab close, page reload, HMR) so they don't
      // bubble up as uncaught exceptions and crash the proxy (#111).
      socket.on("error", () => {
        socket.destroy();
      });
      socket.once("readable", () => {
        const buf: Buffer | null = socket.read(1);
        if (!buf) {
          socket.destroy();
          return;
        }
        socket.unshift(buf);
        if (buf[0] === 0x16) {
          // TLS handshake -> HTTP/2 secure server
          h2Server.emit("connection", socket);
        } else {
          // Plain HTTP -> redirect to HTTPS
          plainServer.emit("connection", socket);
        }
      });
    });

    // Proxy close() through to inner servers so tests and cleanup work.
    const origClose = wrapper.close.bind(wrapper);
    wrapper.close = function (cb?: (err?: Error) => void) {
      h2Server.close();
      plainServer.close();
      return origClose(cb);
    } as typeof wrapper.close;

    return wrapper;
  }

  const httpServer = http.createServer(handleRequest);
  httpServer.on("upgrade", handleUpgrade);

  return httpServer;
}

/**
 * Create a minimal HTTP server that 302-redirects every request to HTTPS.
 * Meant to run on port 80 alongside an HTTPS proxy on port 443.
 */
export function createHttpRedirectServer(httpsPort: number): http.Server {
  return http.createServer((req, res) => {
    const host = (req.headers.host || "localhost").split(":")[0];
    const portSuffix = httpsPort === 443 ? "" : `:${httpsPort}`;
    const location = `https://${host}${portSuffix}${req.url || "/"}`;
    res.writeHead(302, { Location: location, [PORTLESS_HEADER]: "1" });
    res.end();
  });
}
