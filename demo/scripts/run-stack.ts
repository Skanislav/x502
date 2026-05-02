/// Boots the local x502 demo stack:
///   anvil → deploy/seed → coordinator → auto-fulfill → web
///
/// In the new skill-driven architecture there are no verifier-agent
/// processes. Each verifier identity is run by a human via the
/// `x502-verify` Claude skill (`.claude/skills/x502-verify/SKILL.md`).
/// addresses.json carries the per-verifier signing keys + scope ids;
/// when the operator invokes the skill the keys are loaded into env and
/// the helper at `demo/scripts/x502.ts` does the signing + push.
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

  // 3) coordinator. We pass each verifier's private key on the
  // coordinator's env, scoped by `VERIFIER_<id>_PRIVATE_KEY`. That env
  // surface flows through to whatever process invokes the x502-verify
  // skill on this machine, since the skill helper (demo/scripts/x502.ts)
  // reads the same scope ids via 1claw local mode.
  const verifierKeyEnv: Record<string, string> = {};
  for (const v of rt.verifiers) {
    verifierKeyEnv[`VERIFIER_${v.agentId}_PRIVATE_KEY`] = v.privateKey;
  }

  process.stdout.write(`[run-stack] starting coordinator on :${rt.coordinator.port}\n`);
  const coordinator = spawnNode("coordinator", "packages/coordinator/src/main.ts", {
    COORDINATOR_PORT: String(rt.coordinator.port),
    ONECLAW_MODE: "local",
    COORDINATOR_ONECLAW_SCOPE_ID: "COORDINATOR_PRIVATE_KEY",
    COORDINATOR_PRIVATE_KEY: rt.deployerKey,
    RPC_URL: rt.rpcUrl,
    COORDINATOR_CHAIN_ID: String(rt.chainId),
    VAULT_ADDRESS: rt.contracts.vault,
    FACT_PROVIDER_ADDRESS: rt.contracts.factProvider,
    COORDINATOR_REPO: rt.repo.slug,
    COORDINATOR_THRESHOLD: String(rt.repo.threshold),
    COORDINATOR_TRUSTED_AGENT_IDS: rt.repo.trustedAgentIds.join(","),
    COORDINATOR_FACT_TIMEOUT_MS: "30000",
    COORDINATOR_ATTESTATION_TIMEOUT_MS: "300000",
  });
  procs.push({ name: "coordinator", child: coordinator });

  // 4) auto-fulfill (DON simulator)
  process.stdout.write("[run-stack] starting auto-fulfill watcher\n");
  const fulfill = spawnNode("auto-fulfill", "demo/scripts/auto-fulfill.ts");
  procs.push({ name: "auto-fulfill", child: fulfill });

  // 5) web (Next.js)
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

  // 6) Wait for health
  await waitForHealth(`${rt.coordinator.endpoint}/health`, "coordinator");

  process.stdout.write("\n");
  process.stdout.write("┌─ x502 demo stack ready ────────────────────────────┐\n");
  process.stdout.write(
    `│ web         http://127.0.0.1:${rt.web.port}/?mode=demo${" ".repeat(Math.max(0, 14 - String(rt.web.port).length))}│\n`,
  );
  process.stdout.write(`│ coordinator ${rt.coordinator.endpoint}                       │\n`);
  process.stdout.write(`│ vault       ${rt.contracts.vault}     │\n`);
  process.stdout.write("│ logs        demo/.runtime/logs/                    │\n");
  process.stdout.write("└────────────────────────────────────────────────────┘\n");
  process.stdout.write("\nVerifiers run as the x502-verify Claude skill.\n");
  process.stdout.write("In a separate terminal:\n");
  process.stdout.write("  source <(./demo/scripts/skill-env.sh)   # exports verifier keys\n");
  process.stdout.write("  claude\n");
  process.stdout.write("  > /x502-verify as agent 101\n\n");
  process.stdout.write("Ctrl-C to stop.\n");

  // Write a helper script that exports the per-verifier keys for the
  // operator's `claude` shell.
  writeSkillEnvScript(rt);

  await new Promise(() => {});
}

function writeSkillEnvScript(rt: ReturnType<typeof readRuntime>): void {
  const path = resolve(REPO_ROOT, "demo", "scripts", "skill-env.sh");
  const lines = [
    "# Auto-generated by run-stack. `source` this in a fresh shell, then run",
    "# `claude` to invoke the x502-verify skill against the running coordinator.",
    `export X502_COORDINATOR=${rt.coordinator.endpoint}`,
    `export X502_VAULT=${rt.contracts.vault}`,
    `export X502_EAS=${rt.contracts.eas}`,
    `export X502_SCHEMA_UID=${rt.schemaUID}`,
    `export X502_CHAIN_ID=${rt.chainId}`,
    `export X502_REPO=${rt.repo.slug}`,
  ];
  for (const v of rt.verifiers) {
    lines.push(`export VERIFIER_${v.agentId}_PRIVATE_KEY=${v.privateKey}`);
  }
  const fs = require("node:fs") as typeof import("node:fs");
  fs.writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o755 });
}

main().catch((e) => {
  console.error("[run-stack] failed:", e);
  process.exit(1);
});
