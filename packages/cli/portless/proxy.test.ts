import { createProxyServer, type ProxyServer } from "./proxy";
import * as http from "node:http";

/** Helper type covering both http.Server and http2.Http2SecureServer */
type AnyServer = http.Server | ProxyServer;

function listen(server: AnyServer, port: number): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function request(
  port: number,
  headers: http.OutgoingHttpHeaders = {},
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "GET",
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode || 0, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// const appServer = http.createServer((_req, res) => {
//   res.writeHead(200, { "Content-Type": "text/plain" });
//   res.end("ok");
// });
// await listen(appServer, 5173);

const server = createProxyServer({
  getRoutes: () => [
    {
      port: 5173,
      hostname: "app.localhost",
    },
  ],
  proxyPort: 5172,
  mode: "port",
});

await listen(server, 5172);

// const res = await request(5172, { Host: "app.localhost" });
// if (res.statusCode !== 200 || res.body !== "ok") {
//   throw new Error(
//     `Proxy sanity check failed: expected 200/ok, got ${res.statusCode}/${JSON.stringify(res.body)}`,
//   );
// }

// server.close();
// appServer.close();

process.on("SIGINT", () => {
  server.close();
  //   appServer.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.close();
  //   appServer.close();
  process.exit(0);
});
