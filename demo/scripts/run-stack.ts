/// Boots the local x502 demo stack:
///   anvil → deploy/seed → coordinator → 3 verifiers → auto-fulfill → web
///
/// Logs from each subprocess are tee'd to stdout (prefixed) and to
/// demo/.runtime/logs/<name>.log. Ctrl-C tears everything down.

import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startAnvil } from "./lib/anvil.js";
import { RUNTIME_DIR, ensureRuntimeDir, readRuntime } from "./lib/runtime.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const COORDINATOR_PORT = Number(process.env.COORDINATOR_PORT ?? "8787");
const WEB_PORT = Number(process.env.WEB_PORT ?? "3000");

interface RunningProc {
  name: string;
  child: ChildProcess;
}

function tee(name: string, child: ChildProcess, logPath: string) {
  const out = createWriteStream(logPath, { flags: "a" });
  const prefix = `[${name}] `;
  child.stdout?.on("data", (d) => {
    out.write(d);
    process.stdout.write(`${prefix}${d.toString().replace(/\n$/, "")}\n`);
  });
  child.stderr?.on("data", (d) => {
    out.write(d);
    process.stderr.write(`${prefix}${d.toString().replace(/\n$/, "")}\n`);
  });
}

function spawnNode(name: string, file: string, env: NodeJS.ProcessEnv = {}): ChildProcess {
  const logPath = resolve(RUNTIME_DIR, "logs", `${name}.log`);
  const child = spawn("pnpm", ["exec", "tsx", file], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  tee(name, child, logPath);
  return child;
}

function spawnPnpm(name: string, args: string[], env: NodeJS.ProcessEnv = {}): ChildProcess {
  const logPath = resolve(RUNTIME_DIR, "logs", `${name}.log`);
  const child = spawn("pnpm", args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  tee(name, child, logPath);
  return child;
}

async function waitForHealth(url: string, label: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${label} not healthy at ${url} after ${timeoutMs}ms`);
}

async function main() {
  ensureRuntimeDir();
  mkdirSync(resolve(RUNTIME_DIR, "logs"), { recursive: true });

  const procs: RunningProc[] = [];
  const cleanup = async () => {
    process.stdout.write("\n[run-stack] shutting down\n");
    for (const p of procs.reverse()) {
      try {
        p.child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // 1) anvil
  process.stdout.write("[run-stack] starting anvil on :8545\n");
  const anvil = await startAnvil({
    port: 8545,
    logFile: resolve(RUNTIME_DIR, "logs", "anvil.log"),
  });
  procs.push({ name: "anvil", child: anvil.child });
  if (anvil.child.stdout) {
    const out = createWriteStream(resolve(RUNTIME_DIR, "logs", "anvil.log"), { flags: "a" });
    anvil.child.stdout.on("data", (d) => out.write(d));
    anvil.child.stderr?.on("data", (d) => out.write(d));
  }

  // 2) seed
  process.stdout.write("[run-stack] seeding contracts + repo config\n");
  await new Promise<void>((res, rej) => {
    const seedLog = openSync(resolve(RUNTIME_DIR, "logs", "seed.log"), "a");
    const c = spawn(
      "pnpm",
      [
        "exec",
        "tsx",
        "demo/scripts/seed.ts",
        "--rpc-url",
        anvil.rpcUrl,
        "--coordinator-port",
        String(COORDINATOR_PORT),
        "--web-port",
        String(WEB_PORT),
      ],
      { cwd: REPO_ROOT, stdio: ["ignore", seedLog, seedLog] },
    );
    c.on("exit", (code) => (code === 0 ? res() : rej(new Error(`seed exited ${code}`))));
  });
  const rt = readRuntime();

  // 3) coordinator
  process.stdout.write(`[run-stack] starting coordinator on :${rt.coordinator.port}\n`);
  const coordinator = spawnNode("coordinator", "packages/coordinator/src/main.ts", {
    COORDINATOR_PORT: String(rt.coordinator.port),
    COORDINATOR_PRIVATE_KEY: rt.deployerKey,
    RPC_URL: rt.rpcUrl,
    COORDINATOR_CHAIN_ID: String(rt.chainId),
    VAULT_ADDRESS: rt.contracts.vault,
    FACT_PROVIDER_ADDRESS: rt.contracts.factProvider,
    COORDINATOR_REPO: rt.repo.slug,
    COORDINATOR_THRESHOLD: String(rt.repo.threshold),
    COORDINATOR_TRUSTED_AGENT_IDS: rt.repo.trustedAgentIds.join(","),
    COORDINATOR_VERIFIER_ENDPOINTS: rt.verifiers.map((v) => v.endpoint).join(","),
    COORDINATOR_VERIFIER_AGENT_IDS: rt.verifiers.map((v) => v.agentId).join(","),
    COORDINATOR_FACT_TIMEOUT_MS: "30000",
    COORDINATOR_VERIFIER_TIMEOUT_MS: "20000",
  });
  procs.push({ name: "coordinator", child: coordinator });

  // 4) 3 verifier-agents
  for (const v of rt.verifiers) {
    process.stdout.write(`[run-stack] starting verifier ${v.agentId} on :${v.port}\n`);
    const child = spawnNode(`verifier-${v.agentId}`, "packages/verifier-agent/src/main.ts", {
      VERIFIER_AGENT_ID: v.agentId,
      VERIFIER_VAULT_ADDRESS: rt.contracts.vault,
      VERIFIER_CHAIN_ID: String(rt.chainId),
      VERIFIER_PORT: String(v.port),
      VERIFIER_REPO_SLUG: rt.repo.slug,
      VERIFIER_AGENT_REGISTRY_ADDRESS: rt.contracts.registry,
      WALLET_PROVIDER: "envkey",
      VERIFIER_PRIVATE_KEY: v.privateKey,
      RPC_URL: rt.rpcUrl,
    });
    procs.push({ name: `verifier-${v.agentId}`, child });
  }

  // 5) auto-fulfill (DON simulator)
  process.stdout.write("[run-stack] starting auto-fulfill watcher\n");
  const fulfill = spawnNode("auto-fulfill", "demo/scripts/auto-fulfill.ts");
  procs.push({ name: "auto-fulfill", child: fulfill });

  // 6) web (Next.js)
  if (process.env.SKIP_WEB !== "1") {
    process.stdout.write(`[run-stack] starting web on :${rt.web.port}\n`);
    const web = spawnPnpm(
      "web",
      ["--filter", "@x502/web", "dev", "--", "-p", String(rt.web.port)],
      {
        NEXT_PUBLIC_COORDINATOR_URL: rt.coordinator.endpoint,
        NEXT_PUBLIC_DEMO_RUNTIME: "1",
      },
    );
    procs.push({ name: "web", child: web });
  }

  // 7) Wait for health
  await waitForHealth(`${rt.coordinator.endpoint}/health`, "coordinator");
  for (const v of rt.verifiers) {
    await waitForHealth(`${v.endpoint}/health`, `verifier-${v.agentId}`);
  }

  process.stdout.write("\n");
  process.stdout.write("┌─ x502 demo stack ready ────────────────────────────┐\n");
  process.stdout.write(
    `│ web         http://127.0.0.1:${rt.web.port}/?mode=demo${" ".repeat(Math.max(0, 14 - String(rt.web.port).length))}│\n`,
  );
  process.stdout.write(`│ coordinator ${rt.coordinator.endpoint}                       │\n`);
  process.stdout.write(`│ vault       ${rt.contracts.vault}     │\n`);
  process.stdout.write("│ logs        demo/.runtime/logs/                    │\n");
  process.stdout.write("└────────────────────────────────────────────────────┘\n");
  process.stdout.write("Ctrl-C to stop.\n");

  await new Promise(() => {});
}

main().catch((e) => {
  console.error("[run-stack] failed:", e);
  process.exit(1);
});
