/**
 * Standalone Node entry for the portless proxy. Spawned as a child process
 * when the CLI runs under Bun, because Bun's http.Server upgrade path does
 * not reliably complete WebSocket handshakes (HMR stays pending forever).
 */
import { createProxyServer } from "./proxy.ts";
import { LISTEN_HOST } from "../src/util/service-endpoints.ts";

type WorkerConfig = {
  proxyPort: number;
  routes: { hostname: string; port: number }[];
  mode?: "host" | "port";
  strict?: boolean;
};

const raw = process.env.DDDX_PROXY_CONFIG;
if (!raw) {
  console.error("DDDX_PROXY_CONFIG is required");
  process.exit(1);
}

let config: WorkerConfig;
try {
  config = JSON.parse(raw) as WorkerConfig;
} catch {
  console.error("DDDX_PROXY_CONFIG is invalid JSON");
  process.exit(1);
}

const server = createProxyServer({
  getRoutes: () => config.routes,
  proxyPort: config.proxyPort,
  mode: config.mode,
  strict: config.strict,
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(config.proxyPort, LISTEN_HOST, () => {
  process.stdout.write("ready\n");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error(`Proxy worker error: ${err.message}`);
  process.exit(1);
});
