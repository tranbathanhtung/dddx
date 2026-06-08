import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import {
  createProxyServer,
  type ProxyServer,
  type ProxyServerOptions,
} from "@/portless/proxy";
import {
  isPortListening,
  isWindows,
  killListenerOnPort,
} from "@/portless/cli-utils";
import { Log } from "./util/log";
import { LISTEN_HOST } from "./util/service-endpoints";

const log = Log.create({ service: "proxy" });

export type ManagedProxyServer = ProxyServer | SubprocessProxy;

type SubprocessProxy = {
  close: (callback?: (err?: Error) => void) => void;
};

const isBunRuntime = typeof process.versions.bun === "string";

const PROXY_WORKER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../portless/proxy-worker.ts",
);

async function waitForPortFree(port: number, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortListening(port))) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Port ${port} is still in use`);
}

async function waitForProxyListen(
  port: number,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortListening(port)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Proxy did not start listening on port ${port}`);
}

async function startProxyServerInNodeWorker(
  options: ProxyServerOptions,
): Promise<SubprocessProxy> {
  const port = options.proxyPort;
  // Reap orphan workers left by bun --hot reloads before re-binding.
  killListenerOnPort(port, "SIGTERM");
  await waitForPortFree(port).catch(() => {});

  const child: ChildProcess = spawn(
    "node",
    ["--experimental-strip-types", PROXY_WORKER_PATH],
    {
      env: {
        ...process.env,
        DDDX_PROXY_CONFIG: JSON.stringify({
          proxyPort: options.proxyPort,
          routes: options.getRoutes(),
          mode: options.mode,
          strict: options.strict,
        }),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += String(chunk);
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    child.once("error", (err) => finish(() => reject(err)));
    child.once("exit", (code) => {
      if (settled) return;
      finish(() =>
        reject(
          new Error(
            stderr.trim() ||
              `Proxy worker exited with code ${code ?? "unknown"}`,
          ),
        ),
      );
    });

    void waitForProxyListen(port)
      .then(() => finish(resolve))
      .catch((err) => finish(() => reject(err)));
  });

  log.info("Proxy server started (node worker)", { port });

  return {
    close: (callback) => {
      if (child.exitCode !== null || child.killed) {
        callback?.();
        return;
      }
      child.once("exit", () => callback?.());
      child.kill("SIGTERM");
    },
  };
}

function printListenError(err: NodeJS.ErrnoException, port: number): void {
  if (err.code === "EADDRINUSE") {
    console.error(chalk.red(`Port ${port} is already in use.`));
    console.error(chalk.blue("Stop the existing proxy first:"));
    console.error(chalk.cyan("  portless proxy stop"));
    console.error(chalk.blue("Or check what is using the port:"));
    console.error(
      chalk.cyan(
        isWindows
          ? `  netstat -ano | findstr :${port}`
          : `  lsof -ti tcp:${port}`,
      ),
    );
  } else if (err.code === "EACCES") {
    console.error(chalk.red(`Permission denied for port ${port}.`));
    console.error(chalk.blue("Use an unprivileged port (no sudo needed):"));
  } else {
    console.error(chalk.red(`Proxy error: ${err.message}`));
  }
}

export type DevProxyRoute = {
  proxyPort: number;
  appPort: number;
  hostname?: string;
};

export function createDevProxyOptions(
  route: DevProxyRoute,
): ProxyServerOptions {
  return {
    getRoutes: () => [
      {
        port: route.appPort,
        hostname: route.hostname ?? "dddx.localhost",
      },
    ],
    proxyPort: route.proxyPort,
    mode: "port",
  };
}

export const startProxyServer = async (
  options: ProxyServerOptions,
): Promise<ManagedProxyServer> => {
  if (isBunRuntime) {
    try {
      return await startProxyServerInNodeWorker(options);
    } catch (err) {
      const port = options.proxyPort;
      if (err instanceof Error && err.message.includes("EADDRINUSE")) {
        printListenError(
          Object.assign(err, { code: "EADDRINUSE" }) as NodeJS.ErrnoException,
          port,
        );
      }
      log.error("Proxy worker failed to start", { error: err });
      throw err;
    }
  }

  return new Promise<ProxyServer>((resolve, reject) => {
    const port = options.proxyPort;
    const server = createProxyServer(options);

    server.listen(port, LISTEN_HOST, () => {
      log.info("Proxy server started", { port });
      resolve(server);
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      printListenError(err, port);
      log.error("Proxy server error", { error: err });
      reject(err);
    });
  });
};
