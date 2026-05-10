import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Address, Hex } from "viem";

/// JSON state shared across demo scripts. Lives at `demo/.runtime/addresses.json`.
export interface DemoRuntime {
  rpcUrl: string;
  chainId: number;
  /// Optional. Only set when running against a chain the demo itself
  /// provisions (legacy local mode). For Base Sepolia this is undefined —
  /// each on-chain action signs with its own dedicated key from .env
  /// (PRIVATE_KEY, COORDINATOR_PRIVATE_KEY, VERIFIER_PRIVATE_KEY).
  deployerKey?: Hex;
  contracts: {
    usdc: Address;
    registry: Address;
    factProvider: Address;
    vault: Address;
    /// Real EAS predeploy at 0x4200…0021 on Base Sepolia.
    eas: Address;
  };
  /// Schema UID under which verifiers attest. The vault rejects attestations
  /// from any other schema.
  schemaUID: Hex;
  repo: {
    slug: string;
    repoId: Hex;
    threshold: number;
    trustedAgentIds: string[];
  };
  verifiers: Array<{
    agentId: string;
    privateKey: Hex;
    address: Address;
    endpoint: string;
    port: number;
  }>;
  coordinator: { endpoint: string; port: number };
  web: { port: number };
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
