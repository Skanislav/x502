/// Verifier-agent entrypoint. Bootstraps a wallet (env-key OR CDP/AgentKit),
/// builds the Hono app, and serves on the configured port.
///
///   pnpm --filter @x502/verifier-agent start
///
/// Required env (see .env.example for the full surface):
///   VERIFIER_AGENT_ID         ERC-8004 token id this agent represents
///   VERIFIER_VAULT_ADDRESS    BountyVault address on the chain below
///   VERIFIER_CHAIN_ID         84532 = Base Sepolia, 8453 = Base
///   VERIFIER_PORT             default 9000
///   WALLET_PROVIDER           envkey (default) | cdp
///
/// Optional — if both ANTHROPIC_API_KEY and GITHUB_TOKEN are set, the agent
/// boots with ClaudePolicy instead of AcceptAllPolicy. If
/// VERIFIER_AGENT_REGISTRY_ADDRESS is also set, the policy enforces the
/// wallet-binding check (recipient == registry.getAgentWallet(agentIdReveal)).

import Anthropic from "@anthropic-ai/sdk";
import { serve } from "@hono/node-server";
import { Octokit } from "@octokit/rest";
import type { AgentRegistryClient } from "@x502/shared";
import { http, type Address, createPublicClient, isAddress } from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

import { AcceptAllPolicy, type DecisionPolicy } from "./decide.js";
import { ClaudePolicy } from "./policies/claude.js";
import { buildVerifierApp } from "./server.js";
import { pickWalletProviderFromEnv } from "./wallet/index.js";

function chainFromId(id: number) {
  if (id === base.id) return base;
  if (id === baseSepolia.id) return baseSepolia;
  if (id === foundry.id) return foundry;
  throw new Error(`unsupported chainId ${id}`);
}

function buildPolicy(env: NodeJS.ProcessEnv, chainId: number): DecisionPolicy {
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const githubToken = env.GITHUB_TOKEN;
  if (!anthropicKey || !githubToken) return new AcceptAllPolicy();

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const octokit = new Octokit({ auth: githubToken });

  const registryAddress = env.VERIFIER_AGENT_REGISTRY_ADDRESS;
  let walletBinding: AgentRegistryClient | undefined;
  if (registryAddress && isAddress(registryAddress)) {
    const chain = chainFromId(chainId);
    // Cast — viem infers PublicClient generics from the chain union in a way
    // strict TS can't unify; the AgentRegistryClient interface only needs
    // `readContract`, which is invariant across the union.
    const client = createPublicClient({
      chain,
      transport: http(env.RPC_URL),
    }) as unknown as AgentRegistryClient["client"];
    walletBinding = { client, address: registryAddress };
  }

  return new ClaudePolicy({ anthropic, octokit, walletBinding });
}

async function main() {
  const env = process.env;

  const agentId = BigInt(env.VERIFIER_AGENT_ID ?? "");
  const vault = env.VERIFIER_VAULT_ADDRESS;
  if (!vault || !isAddress(vault)) {
    throw new Error("VERIFIER_VAULT_ADDRESS must be a 0x-address");
  }
  const chainId = Number(env.VERIFIER_CHAIN_ID ?? "84532");
  const chain = chainFromId(chainId);
  const port = Number(env.VERIFIER_PORT ?? "9000");
  const repoSlug = env.VERIFIER_REPO_SLUG ?? "";

  const provider = pickWalletProviderFromEnv(env);
  const wallet = await provider.bootstrap({
    chain,
    rpcUrl: env.RPC_URL,
    agentId,
  });

  const policy = buildPolicy(env, chainId);

  const app = buildVerifierApp({
    signer: {
      agentId: wallet.agentId,
      vault: vault as Address,
      chainId,
      account: wallet.account,
      wallet: wallet.walletClient,
    },
    policy,
    repoSlugResolver: (_id) => repoSlug || undefined,
  });

  // eslint-disable-next-line no-console
  console.log(
    `[x502 verifier] agentId=${wallet.agentId} address=${wallet.address} ` +
      `via=${wallet.source} chainId=${chainId} vault=${vault} port=${port} ` +
      `policy=${policy.constructor.name}`,
  );
  serve({ fetch: app.fetch, port });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("verifier-agent boot failed:", e);
  process.exit(1);
});
