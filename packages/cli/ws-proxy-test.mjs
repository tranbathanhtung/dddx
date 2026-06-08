import * as http from "node:http";
import { createProxyServer } from "./portless/proxy.ts";

const backend = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
});
backend.on("upgrade", (req, socket) => {
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n");
  socket.write("connected");
  setTimeout(() => socket.end(), 100);
});

await new Promise((r) => backend.listen(0, "127.0.0.1", r));
const backendPort = backend.address().port;

const proxy = createProxyServer({
  getRoutes: () => [{ port: backendPort, hostname: "dddx.localhost" }],
  proxyPort: 0,
  mode: "port",
});
await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
const proxyPort = proxy.address().port;

const result = await new Promise((resolve, reject) => {
  const req = http.request({
    hostname: "127.0.0.1",
    port: proxyPort,
    path: "/?token=test",
    method: "GET",
    headers: {
      Host: `localhost:${proxyPort}`,
      Upgrade: "websocket",
      Connection: "Upgrade",
      "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      "Sec-WebSocket-Version": "13",
    },
  });
  req.on("upgrade", (res, socket) => {
    let data = "";
    socket.on("data", (c) => (data += c));
    socket.on("end", () => resolve({ status: res.statusCode, data }));
    socket.on("error", reject);
  });
  req.on("response", (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => resolve({ status: res.statusCode, body, type: "response" }));
  });
  req.on("error", reject);
  req.setTimeout(3000, () => reject(new Error("timeout")));
  req.end();
});

console.log("result:", JSON.stringify(result));
proxy.close();
backend.close();
