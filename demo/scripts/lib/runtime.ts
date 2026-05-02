import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Address, Hex } from "viem";

/// JSON state shared across demo scripts. Lives at `demo/.runtime/addresses.json`.
export interface DemoRuntime {
  rpcUrl: string;
  chainId: number;
  /// Anvil prefunded key (deployer + repo owner + coordinator).
  deployerKey: Hex;
  contracts: {
    usdc: Address;
    registry: Address;
    factProvider: Address;
    vault: Address;
  };
  repo: {
    slug: string;
    repoId: Hex;
    threshold: number;
    trustedAgentIds: string[]; // bigints serialized
  };
  verifiers: Array<{
    agentId: string; // bigint serialized
    privateKey: Hex;
    /// On-chain identity registered in the AgentRegistry. For smart-wallet
    /// verifiers this is the predicted CREATE2 address (the wallet may not
    /// be deployed yet — vault deploys it on the first 6492-wrapped sig).
    address: Address;
    endpoint: string;
    port: number;
    /// When set, this verifier is a smart-account signer. Run-stack passes
    /// these to the verifier process as `VERIFIER_SMART_WALLET_*` env vars
    /// so signAttestation produces ERC-6492 wrapped sigs.
    smartWallet?: {
      address: Address;
      ownerAddress: Address;
      factory: Address;
      factoryCalldata: Hex;
    };
  }>;
  coordinator: { endpoint: string; port: number };
  web: { port: number };
  /// Optional factory address — only present when `DEMO_SMART_WALLET=1` was
  /// set during seed. Useful for the web UI / debugging.
  smartWalletFactory?: Address;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
export const RUNTIME_DIR = resolve(__dirname, "..", "..", ".runtime");
export const ADDRESSES_PATH = resolve(RUNTIME_DIR, "addresses.json");

export function ensureRuntimeDir(): void {
  mkdirSync(RUNTIME_DIR, { recursive: true });
}

export function writeRuntime(rt: DemoRuntime): void {
  ensureRuntimeDir();
  writeFileSync(ADDRESSES_PATH, `${JSON.stringify(rt, null, 2)}\n`);
}

export function readRuntime(): DemoRuntime {
  return JSON.parse(readFileSync(ADDRESSES_PATH, "utf8")) as DemoRuntime;
}
