import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";

export interface AnvilHandle {
  rpcUrl: string;
  port: number;
  child: ChildProcess;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      if (typeof addr === "object" && addr) {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("could not get port")));
      }
    });
  });
}

async function waitFor(rpcUrl: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 50));
  }
  throw new Error(`anvil at ${rpcUrl} not ready after ${timeoutMs}ms`);
}

export async function startAnvil(
  opts: { port?: number; logFile?: string; forkUrl?: string } = {},
): Promise<AnvilHandle> {
  const port = opts.port ?? (await freePort());
  const rpcUrl = `http://127.0.0.1:${port}`;
  const args = ["--port", String(port), "--silent", "--block-time", "1"];
  if (opts.forkUrl) {
    // Fork mode: anvil reads state from the live RPC, so contracts that
    // exist on the source chain (USDC, EAS, SchemaRegistry) are reachable
    // at their real addresses. Default chainId stays at 31337 so existing
    // viem chains map correctly; pass --chain-id to override.
    args.push("--fork-url", opts.forkUrl);
  }
  const child: ChildProcess = spawn("anvil", args, { stdio: ["ignore", "pipe", "pipe"] });

  let stderrBuf = "";
  child.stderr?.on("data", (d) => {
    stderrBuf += String(d);
  });

  const stop = async (): Promise<void> => {
    if (!child.killed) child.kill("SIGTERM");
    await new Promise<void>((res) => {
      const t = setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
        res();
      }, 2000);
      child.once("exit", () => {
        clearTimeout(t);
        res();
      });
    });
  };

  try {
    await waitFor(rpcUrl, 10_000);
  } catch (e) {
    await stop();
    throw new Error(`${(e as Error).message}\nanvil stderr: ${stderrBuf}`);
  }

  return { rpcUrl, port, child, stop };
}
