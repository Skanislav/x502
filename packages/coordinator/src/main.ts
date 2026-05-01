/// Coordinator HTTP entrypoint.
///
///   pnpm --filter @x502/coordinator start
///
/// Required env (see .env.example):
///   COORDINATOR_PORT                default 8787
///   RPC_URL                         JSON-RPC endpoint
///   COORDINATOR_CHAIN_ID            31337 = anvil, 84532 = Base Sepolia
///   VAULT_ADDRESS
///   FACT_PROVIDER_ADDRESS           MockGitHubFactProvider OR GitHubFactReceiver
///   COORDINATOR_REPO                owner/repo
///   COORDINATOR_THRESHOLD           M-of-N
///   COORDINATOR_TRUSTED_AGENT_IDS   comma-separated bigints
///   COORDINATOR_VERIFIER_ENDPOINTS  comma-separated http://host:port URLs
///   COORDINATOR_VERIFIER_AGENT_IDS  comma-separated bigints, same length
///   COORDINATOR_FACT_TIMEOUT_MS     default 120000
///   COORDINATOR_VERIFIER_TIMEOUT_MS default 30000
///
/// Wallet:
///   ONECLAW_MODE                    local (default) | remote
///   COORDINATOR_ONECLAW_SCOPE_ID    1claw scope for the submitter wallet
///                                   (default `COORDINATOR_PRIVATE_KEY`,
///                                   which in local mode is also the env-var
///                                   name holding the key).

import { serve } from "@hono/node-server";
import { oneClawAccount, pickOneClawFromEnv } from "@x502/shared";
import {
  http,
  type Account,
  type Address,
  createPublicClient,
  createWalletClient,
  isAddress,
} from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

import {
  FetchVerifierClient,
  StaticRepoRegistry,
  ViemFactProvider,
  ViemVaultWriter,
  buildCoordinator,
} from "./index.js";

function chainFromId(id: number) {
  if (id === base.id) return base;
  if (id === baseSepolia.id) return baseSepolia;
  if (id === foundry.id) return foundry;
  throw new Error(`unsupported chainId ${id}`);
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`missing required env ${key}`);
  return v;
}

async function main() {
  const env = process.env;
  const port = Number(env.COORDINATOR_PORT ?? "8787");
  const chainId = Number(env.COORDINATOR_CHAIN_ID ?? "31337");
  const chain = chainFromId(chainId);
  const rpcUrl = required(env, "RPC_URL");

  const vault = required(env, "VAULT_ADDRESS");
  const factProviderAddr = required(env, "FACT_PROVIDER_ADDRESS");
  if (!isAddress(vault)) throw new Error("VAULT_ADDRESS must be a 0x-address");
  if (!isAddress(factProviderAddr)) throw new Error("FACT_PROVIDER_ADDRESS must be a 0x-address");

  // Coordinator wallet flows through 1claw too — same custody surface as the
  // verifiers. In local mode the scope id is the env-var name holding a raw
  // key; in remote mode it's whatever identifier the 1claw service exposes.
  const oneClaw = pickOneClawFromEnv(env);
  const scopeId = env.COORDINATOR_ONECLAW_SCOPE_ID ?? "COORDINATOR_PRIVATE_KEY";
  const scope = await oneClaw.resolveScope(scopeId);
  const account = oneClawAccount(oneClaw, scopeId, scope.address);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ transport, chain, pollingInterval: 200 });
  const wallet = createWalletClient({ transport, chain, account });

  const repoSlug = required(env, "COORDINATOR_REPO");
  const threshold = Number(required(env, "COORDINATOR_THRESHOLD"));
  const trustedAgentIds = required(env, "COORDINATOR_TRUSTED_AGENT_IDS")
    .split(",")
    .map((s) => BigInt(s.trim()));
  const verifierEndpoints = required(env, "COORDINATOR_VERIFIER_ENDPOINTS")
    .split(",")
    .map((s) => s.trim());
  const verifierAgentIds = required(env, "COORDINATOR_VERIFIER_AGENT_IDS")
    .split(",")
    .map((s) => BigInt(s.trim()));
  if (verifierEndpoints.length !== verifierAgentIds.length) {
    throw new Error("COORDINATOR_VERIFIER_ENDPOINTS and _AGENT_IDS must be same length");
  }

  const repoRegistry = new StaticRepoRegistry();
  repoRegistry.add(repoSlug, threshold, trustedAgentIds);

  const factProvider = new ViemFactProvider(
    publicClient as never,
    wallet as never,
    account as Account,
    factProviderAddr as Address,
  );
  factProvider.start();

  const vaultWriter = new ViemVaultWriter(
    publicClient as never,
    wallet as never,
    account as Account,
    vault as Address,
  );

  const verifiers = verifierEndpoints.map(
    (endpoint, i) => new FetchVerifierClient(verifierAgentIds[i]!, endpoint),
  );

  const coord = buildCoordinator({
    factProvider,
    vault: vaultWriter,
    repoRegistry,
    verifiers,
    factTimeoutMs: Number(env.COORDINATOR_FACT_TIMEOUT_MS ?? "120000"),
    verifierTimeoutMs: Number(env.COORDINATOR_VERIFIER_TIMEOUT_MS ?? "30000"),
  });

  // eslint-disable-next-line no-console
  console.log(
    `[x502 coordinator] port=${port} chainId=${chainId} vault=${vault} ` +
      `factProvider=${factProviderAddr} repo=${repoSlug} threshold=${threshold} ` +
      `verifiers=${verifierEndpoints.length} wallet=oneclaw:${scope.kind}@${scope.address}`,
  );
  serve({ fetch: coord.app.fetch, port });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("coordinator boot failed:", e);
  process.exit(1);
});
