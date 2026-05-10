/// Builds `demo/.runtime/addresses.json` for the Base Sepolia demo. Pure
/// metadata: pulls live addresses + signing config from `.env` + the
/// documented Base Sepolia constants. Does NOT deploy anything; the demo
/// runs against the existing live BountyVault, GitHubFactReceiver, EAS,
/// and SchemaRegistry on chain `84532`.
///
///   tsx demo/scripts/seed.ts
///     [--coordinator-port 8787] [--web-port 3000]
///
/// Env (sourced from `.env` automatically if present):
///   BASE_SEPOLIA_RPC_URL    required
///   VAULT_ADDRESS           required (live BountyVault)
///   FACT_PROVIDER_ADDRESS   required (live GitHubFactReceiver)
///   VERIFIER_PRIVATE_KEY    required (signing key for trusted verifier 5260)
///   VERIFIER_AGENT_ID       optional, defaults to 5260
///   VERIFIER_REPO_SLUG      optional, defaults to skanislav/x502
///   USDC_ADDRESS            optional, defaults to live Base Sepolia USDC
///   COORDINATOR_THRESHOLD   optional, defaults to 1

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { type Address, type Hex, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { repoIdFromSlug } from "@x502/shared";

import { loadDotEnv } from "./lib/load-env.js";
import { type DemoRuntime, writeRuntime } from "./lib/runtime.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const BASE_SEPOLIA_CHAIN_ID = 84532;

/// Optimism / Base canonical predeploy for EAS — same address across mainnet
/// + Base Sepolia. https://docs.attest.org/
const EAS_PREDEPLOY = "0x4200000000000000000000000000000000000021" as Address;

/// x502 schema UID on Base Sepolia, registered once via SchemaRegistry.
/// `keccak256(abi.encodePacked(schema, resolver, revocable))` for
/// `bytes32 claimId,bytes32 factHash,bool accept`.
const X502_SCHEMA_UID = "0x5dcd6b7851d582fe235f915024912fe525f2fc63cd477511182213c1b065e3c6" as Hex;

/// ERC-8004 IdentityRegistry on Base Sepolia. See docs/runbook-base-sepolia.md.
const ERC_8004_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address;

/// Circle USDC on Base Sepolia.
const DEFAULT_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;

const DEFAULT_AGENT_ID = "5260";
const DEFAULT_REPO_SLUG = "skanislav/x502";
const DEFAULT_THRESHOLD = 1;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env ${name} (source .env first)`);
  return v;
}

function asAddress(name: string, value: string): Address {
  if (!isAddress(value)) throw new Error(`${name} is not a 0x-address: ${value}`);
  return value as Address;
}

function asHex(name: string, value: string): Hex {
  if (!isHex(value)) throw new Error(`${name} is not 0x-hex: ${value}`);
  return value as Hex;
}

async function main() {
  loadDotEnv(REPO_ROOT);

  const { values } = parseArgs({
    options: {
      "coordinator-port": { type: "string" },
      "web-port": { type: "string" },
    },
  });
  const coordinatorPort = Number(values["coordinator-port"] ?? "8787");
  const webPort = Number(values["web-port"] ?? "3000");

  const rpcUrl = required("BASE_SEPOLIA_RPC_URL");
  const vault = asAddress("VAULT_ADDRESS", required("VAULT_ADDRESS"));
  const factProvider = asAddress("FACT_PROVIDER_ADDRESS", required("FACT_PROVIDER_ADDRESS"));
  const usdc = asAddress("USDC_ADDRESS", process.env.USDC_ADDRESS ?? DEFAULT_USDC);
  const verifierKey = asHex("VERIFIER_PRIVATE_KEY", required("VERIFIER_PRIVATE_KEY"));
  const verifierAccount = privateKeyToAccount(verifierKey);

  const agentId = process.env.VERIFIER_AGENT_ID ?? DEFAULT_AGENT_ID;
  const repoSlug = process.env.VERIFIER_REPO_SLUG ?? DEFAULT_REPO_SLUG;
  const repoId = repoIdFromSlug(repoSlug);
  const threshold = Number(process.env.COORDINATOR_THRESHOLD ?? String(DEFAULT_THRESHOLD));

  const rt: DemoRuntime = {
    rpcUrl,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    contracts: {
      usdc,
      registry: ERC_8004_REGISTRY,
      factProvider,
      vault,
      eas: EAS_PREDEPLOY,
    },
    schemaUID: X502_SCHEMA_UID,
    repo: {
      slug: repoSlug,
      repoId,
      threshold,
      trustedAgentIds: [agentId],
    },
    verifiers: [
      {
        agentId,
        privateKey: verifierKey,
        address: verifierAccount.address as Address,
        endpoint: "",
        port: 0,
      },
    ],
    coordinator: {
      endpoint: `http://127.0.0.1:${coordinatorPort}`,
      port: coordinatorPort,
    },
    web: { port: webPort },
  };

  writeRuntime(rt);
  process.stdout.write("[seed] wrote demo/.runtime/addresses.json (Base Sepolia)\n");
  process.stdout.write(`[seed]   chainId=${BASE_SEPOLIA_CHAIN_ID}\n`);
  process.stdout.write(`[seed]   vault=${vault}\n`);
  process.stdout.write(`[seed]   factProvider=${factProvider}\n`);
  process.stdout.write(`[seed]   eas=${EAS_PREDEPLOY}\n`);
  process.stdout.write(`[seed]   schemaUID=${X502_SCHEMA_UID}\n`);
  process.stdout.write(`[seed]   verifier agent=${agentId} addr=${verifierAccount.address}\n`);
  process.stdout.write(`[seed]   repo=${repoSlug} threshold=${threshold}\n`);
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
