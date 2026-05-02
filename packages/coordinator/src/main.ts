/// Coordinator HTTP entrypoint.
///
///   pnpm --filter @x502/coordinator start
///
/// In the EAS-driven architecture the coordinator is a passive aggregator:
/// listens for /claim, requests the fact from Chainlink Functions, opens
/// an inbox per claim, watches the on-chain EAS contract for matching
/// attestations under our schema, and submits vault.payout once threshold
/// attestations land. (Vault.payout is permissionless — anyone with the
/// UIDs can call it; the coordinator does so as a convenience.)
///
/// Required env (see .env.example):
///   COORDINATOR_PORT                default 8787
///   RPC_URL                         JSON-RPC endpoint
///   COORDINATOR_CHAIN_ID            31337 = anvil, 84532 = Base Sepolia
///   VAULT_ADDRESS
///   FACT_PROVIDER_ADDRESS           MockGitHubFactProvider OR GitHubFactReceiver
///   EAS_ADDRESS                     0x4200…0021 on Base / Base Sepolia, or
///                                   the MockEAS deployed by demo seed
///   X502_SCHEMA_UID                 keccak schemaUID (registered once via
///                                   EAS's SchemaRegistry in production)
///   COORDINATOR_REPO                owner/repo
///   COORDINATOR_THRESHOLD           M-of-N
///   COORDINATOR_TRUSTED_AGENT_IDS   comma-separated bigints
///   COORDINATOR_TRUSTED_ATTESTERS   comma-separated 0x-addresses, same
///                                   length+order as agent ids
///   COORDINATOR_FACT_TIMEOUT_MS     default 120000
///   COORDINATOR_ATTESTATION_TIMEOUT_MS default 300000 (5min)
///
/// Wallet (the coordinator submits the on-chain payout tx):
///   ONECLAW_MODE                    local (default) | remote
///   COORDINATOR_ONECLAW_SCOPE_ID    1claw scope (default
///                                   COORDINATOR_PRIVATE_KEY)

import { serve } from "@hono/node-server";
import { oneClawAccount, pickOneClawFromEnv } from "@x502/shared";
import {
  http,
  type Account,
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  isAddress,
  isHex,
} from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

import {
  EasAttestationWatcher,
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
  const easAddress = required(env, "EAS_ADDRESS");
  const schemaUIDRaw = required(env, "X502_SCHEMA_UID");
  if (!isAddress(vault)) throw new Error("VAULT_ADDRESS must be a 0x-address");
  if (!isAddress(factProviderAddr)) throw new Error("FACT_PROVIDER_ADDRESS must be a 0x-address");
  if (!isAddress(easAddress)) throw new Error("EAS_ADDRESS must be a 0x-address");
  if (!isHex(schemaUIDRaw) || schemaUIDRaw.length !== 66) {
    throw new Error("X502_SCHEMA_UID must be 0x-prefixed bytes32");
  }
  const schemaUID = schemaUIDRaw as Hex;

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
  const trustedAttesters = required(env, "COORDINATOR_TRUSTED_ATTESTERS")
    .split(",")
    .map((s) => s.trim()) as Address[];
  for (const a of trustedAttesters) {
    if (!isAddress(a)) throw new Error(`COORDINATOR_TRUSTED_ATTESTERS contains non-address: ${a}`);
  }
  if (trustedAgentIds.length !== trustedAttesters.length) {
    throw new Error(
      "COORDINATOR_TRUSTED_AGENT_IDS and COORDINATOR_TRUSTED_ATTESTERS must agree in length",
    );
  }

  const repoRegistry = new StaticRepoRegistry();
  repoRegistry.add(repoSlug, threshold, trustedAgentIds, trustedAttesters);

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

  const watcher = new EasAttestationWatcher(
    publicClient as never,
    easAddress as Address,
    schemaUID,
    coord.inbox,
    (claimId) => coord.claims.get(claimId),
    { warn: (msg: string) => console.warn(`[eas-watcher] ${msg}`) },
  );
  watcher.start();

  // eslint-disable-next-line no-console
  console.log(
    `[x502 coordinator] port=${port} chainId=${chainId} vault=${vault} ` +
      `factProvider=${factProviderAddr} eas=${easAddress} schemaUID=${schemaUID} ` +
      `repo=${repoSlug} threshold=${threshold} trustedAttesters=${trustedAttesters.length} ` +
      `wallet=oneclaw:${scope.kind}@${scope.address}`,
  );
  serve({ fetch: coord.app.fetch, port });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("coordinator boot failed:", e);
  process.exit(1);
});
