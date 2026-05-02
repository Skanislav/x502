/// Seeds an already-running anvil with the x502 demo state.
///
///   tsx demo/scripts/seed.ts --rpc-url http://127.0.0.1:8545
///                           [--coordinator-port 8787] [--web-port 3000]
///                           [--fork]
///
/// Without --fork (local mode):
///   Deploys MockUSDC, MockAgentRegistry, MockGitHubFactProvider, MockEAS,
///   then BountyVault wired to all of them with a deterministic local
///   schemaUID (`keccak256("x502:" + schema)`).
///
/// With --fork (anvil --fork-url Base Sepolia):
///   Deploys the same mocks for USDC + AgentRegistry + FactProvider but
///   reuses the real EAS predeploy at 0x4200…0021 + SchemaRegistry at
///   0x4200…0020. Registers the x502 schema (idempotent) and uses the
///   resulting UID for the vault.

import { parseArgs } from "node:util";
import {
  http,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  parseUnits,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { X502_SCHEMA, deployAll, repoIdFromSlug } from "@x502/shared";
import {
  bountyVaultAbi,
  bountyVaultBytecode,
  mockAgentRegistryAbi,
  mockAgentRegistryBytecode,
  mockGitHubFactProviderAbi,
  mockGitHubFactProviderBytecode,
  mockUSDCAbi,
  mockUSDCBytecode,
} from "@x502/shared/abis";

import { type DemoRuntime, writeRuntime } from "./lib/runtime.js";

const ANVIL_DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const REPO_SLUG = "skanislav/x502";
const VERIFIER_AGENT_IDS = [101n, 102n, 103n] as const;
const VERIFIER_PORTS = [9001, 9002, 9003] as const;

/// Optimism / Base canonical predeploys for EAS + SchemaRegistry — same
/// addresses across mainnet + sepolia. https://docs.attest.org/
const EAS_PREDEPLOY = "0x4200000000000000000000000000000000000021" as Address;
const SCHEMA_REGISTRY_PREDEPLOY = "0x4200000000000000000000000000000000000020" as Address;

const SCHEMA_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getSchema",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "resolver", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "schema", type: "string" },
        ],
      },
    ],
  },
] as const;

async function main() {
  const { values } = parseArgs({
    options: {
      "rpc-url": { type: "string" },
      "coordinator-port": { type: "string" },
      "web-port": { type: "string" },
      fork: { type: "boolean" },
    },
  });
  const rpcUrl = values["rpc-url"] ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const coordinatorPort = Number(values["coordinator-port"] ?? "8787");
  const webPort = Number(values["web-port"] ?? "3000");
  const fork = !!values.fork;

  const deployer = privateKeyToAccount(ANVIL_DEPLOYER_KEY);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ transport, chain: foundry, pollingInterval: 200 });
  const wallet = createWalletClient({ transport, chain: foundry, account: deployer });

  let easAddress: Address;
  let schemaUID: Hex;
  let usdc: Address;
  let registry: Address;
  let factProvider: Address;
  let vault: Address;

  if (fork) {
    process.stdout.write("[seed] FORK MODE — using real EAS + SchemaRegistry predeploys\n");
    easAddress = EAS_PREDEPLOY;
    // Register schema (idempotent — try, then read on revert).
    schemaUID = await ensureSchemaRegistered(
      publicClient as unknown as PublicClient,
      wallet as unknown as WalletClient,
      deployer,
    );
    process.stdout.write(`[seed]   eas=${easAddress}\n`);
    process.stdout.write(`[seed]   schemaUID=${schemaUID}\n`);

    // Still deploy mock USDC + registry + factProvider so the demo is
    // self-contained (real USDC on Base Sepolia would require sourcing
    // testnet funds for the repo owner).
    const pc = publicClient as unknown as PublicClient;
    const wc = wallet as unknown as WalletClient;
    usdc = await deployBytecode(pc, wc, deployer, mockUSDCAbi, mockUSDCBytecode);
    registry = await deployBytecode(
      pc,
      wc,
      deployer,
      mockAgentRegistryAbi,
      mockAgentRegistryBytecode,
    );
    factProvider = await deployBytecode(
      pc,
      wc,
      deployer,
      mockGitHubFactProviderAbi,
      mockGitHubFactProviderBytecode,
    );
    vault = await deployBytecode(pc, wc, deployer, bountyVaultAbi, bountyVaultBytecode, [
      usdc,
      registry,
      factProvider,
      easAddress,
      schemaUID,
    ]);
  } else {
    process.stdout.write("[seed] LOCAL MODE — deploying MockEAS\n");
    const all = await deployAll(
      publicClient as unknown as PublicClient,
      wallet as unknown as WalletClient,
      deployer as Account,
    );
    easAddress = all.eas;
    schemaUID = all.schemaUID;
    usdc = all.usdc;
    registry = all.registry;
    factProvider = all.factProvider;
    vault = all.vault;
    process.stdout.write(`[seed]   eas=${easAddress}\n`);
    process.stdout.write(`[seed]   schemaUID=${schemaUID}\n`);
  }
  process.stdout.write(`[seed]   usdc=${usdc}\n`);
  process.stdout.write(`[seed]   registry=${registry}\n`);
  process.stdout.write(`[seed]   factProvider=${factProvider}\n`);
  process.stdout.write(`[seed]   vault=${vault}\n`);

  const verifiers: DemoRuntime["verifiers"] = VERIFIER_AGENT_IDS.map((agentId, i) => {
    const pk = generatePrivateKey();
    const acc = privateKeyToAccount(pk);
    return {
      agentId: agentId.toString(),
      privateKey: pk,
      address: acc.address as Address,
      endpoint: `http://127.0.0.1:${VERIFIER_PORTS[i]}`,
      port: VERIFIER_PORTS[i]!,
    };
  });

  process.stdout.write("[seed] registering verifier wallets\n");
  for (const v of verifiers) {
    await wallet.writeContract({
      address: registry,
      abi: mockAgentRegistryAbi,
      functionName: "setAgentWallet",
      args: [BigInt(v.agentId), v.address],
      chain: null,
      account: deployer as Account,
    });
  }

  const repoId = repoIdFromSlug(REPO_SLUG);
  const prices = {
    report: parseUnits("0.05", 6),
    triage: parseUnits("0.02", 6),
    fix: parseUnits("0.5", 6),
    docsTests: parseUnits("0.3", 6),
  };
  const outcomeFee = 1_000n;
  const threshold = 2;

  process.stdout.write(`[seed] configuring repo ${REPO_SLUG}\n`);
  await wallet.writeContract({
    address: vault,
    abi: bountyVaultAbi,
    functionName: "configureRepo",
    args: [repoId, VERIFIER_AGENT_IDS, threshold, prices, outcomeFee],
    chain: null,
    account: deployer as Account,
  });

  const funding = parseUnits("2", 6);
  process.stdout.write("[seed] funding vault with 2 USDC\n");
  await wallet.writeContract({
    address: usdc,
    abi: mockUSDCAbi,
    functionName: "mint",
    args: [deployer.address, funding],
    chain: null,
    account: deployer as Account,
  });
  await wallet.writeContract({
    address: usdc,
    abi: mockUSDCAbi,
    functionName: "approve",
    args: [vault, funding],
    chain: null,
    account: deployer as Account,
  });
  await wallet.writeContract({
    address: vault,
    abi: bountyVaultAbi,
    functionName: "deposit",
    args: [repoId, funding],
    chain: null,
    account: deployer as Account,
  });

  const rt: DemoRuntime = {
    rpcUrl,
    chainId: foundry.id,
    deployerKey: ANVIL_DEPLOYER_KEY,
    contracts: { usdc, registry, factProvider, vault, eas: easAddress },
    schemaUID,
    repo: {
      slug: REPO_SLUG,
      repoId,
      threshold,
      trustedAgentIds: VERIFIER_AGENT_IDS.map((id) => id.toString()),
    },
    verifiers,
    coordinator: { endpoint: `http://127.0.0.1:${coordinatorPort}`, port: coordinatorPort },
    web: { port: webPort },
  };
  writeRuntime(rt);
  process.stdout.write("[seed] wrote demo/.runtime/addresses.json\n");
}

async function ensureSchemaRegistered(
  publicClient: PublicClient,
  wallet: WalletClient,
  account: Account,
): Promise<Hex> {
  // EAS computes UID = keccak256(abi.encodePacked(schema, resolver, revocable))
  const { keccak256, encodePacked } = await import("viem");
  const expectedUID = keccak256(
    encodePacked(
      ["string", "address", "bool"],
      [X502_SCHEMA, "0x0000000000000000000000000000000000000000", true],
    ),
  );

  const existing = (await publicClient.readContract({
    address: SCHEMA_REGISTRY_PREDEPLOY,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "getSchema",
    args: [expectedUID],
  } as never)) as { uid: Hex };
  if (existing.uid === expectedUID) return expectedUID;

  process.stdout.write("[seed]   registering x502 schema\n");
  const txHash = await wallet.writeContract({
    address: SCHEMA_REGISTRY_PREDEPLOY,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "register",
    args: [X502_SCHEMA, "0x0000000000000000000000000000000000000000", true],
    chain: null,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return expectedUID;
}

async function deployBytecode(
  publicClient: PublicClient,
  wallet: WalletClient,
  account: Account,
  abi: readonly unknown[],
  bytecode: Hex,
  args: readonly unknown[] = [],
): Promise<Address> {
  const tx = await wallet.deployContract({
    abi: abi as never,
    bytecode,
    args: args as never,
    account,
    chain: null,
  });
  const r = await publicClient.waitForTransactionReceipt({ hash: tx });
  if (!r.contractAddress) throw new Error(`deploy returned no address (tx=${tx})`);
  return r.contractAddress;
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
