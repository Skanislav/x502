/// Coordinator HTTP entrypoint.
///
///   pnpm --filter @x502/coordinator start
///
/// In the new architecture the coordinator is a passive aggregator: it
/// listens for /claim, requests the fact from Chainlink Functions, opens an
/// inbox per claim, and waits for verifier-side skill helpers to push
/// signed attestations via POST /attestation. Once threshold sigs land the
/// vault.payout submits.
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
///   COORDINATOR_FACT_TIMEOUT_MS     default 120000
///   COORDINATOR_ATTESTATION_TIMEOUT_MS default 300000 (5min — humans drive verifiers)
///
/// Wallet (the coordinator's wallet still submits the on-chain payout tx):
///   ONECLAW_MODE                    local (default) | remote
///   COORDINATOR_ONECLAW_SCOPE_ID    1claw scope for the submitter wallet
///                                   (default `COORDINATOR_PRIVATE_KEY`)

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

  const coord = buildCoordinator({
    factProvider,
    vault: vaultWriter,
    repoRegistry,
    factTimeoutMs: Number(env.COORDINATOR_FACT_TIMEOUT_MS ?? "120000"),
    attestationTimeoutMs: Number(env.COORDINATOR_ATTESTATION_TIMEOUT_MS ?? "300000"),
  });

  // eslint-disable-next-line no-console
  console.log(
    `[x502 coordinator] port=${port} chainId=${chainId} vault=${vault} ` +
      `factProvider=${factProviderAddr} repo=${repoSlug} threshold=${threshold} ` +
      `trustedAgents=${trustedAgentIds.join(",")} wallet=oneclaw:${scope.kind}@${scope.address}`,
  );
  serve({ fetch: coord.app.fetch, port });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("coordinator boot failed:", e);
  process.exit(1);
});
