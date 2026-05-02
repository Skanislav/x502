/// Seeds an already-running anvil with the x502 demo state.
///
/// Reads RPC_URL from argv (or env), deploys mocks + vault, registers 3 agent
/// keys in the registry, configures the demo repo, mints + deposits USDC, and
/// writes `demo/.runtime/addresses.json` for downstream scripts.
///
/// Optional: `DEMO_SMART_WALLET=1` deploys MockSmartWalletFactory and turns
/// the third verifier (agent 103) into a counterfactual ERC-1271 smart wallet.
/// The wallet address is registered in the AgentRegistry but the contract is
/// not deployed — the vault deploys it during the first 6492-wrapped payout.

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
  encodeAbiParameters,
  encodeFunctionData,
  parseUnits,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { deployAll, repoIdFromSlug } from "@x502/shared";
import {
  bountyVaultAbi,
  mockAgentRegistryAbi,
  mockSmartWalletFactoryAbi,
  mockSmartWalletFactoryBytecode,
  mockUSDCAbi,
} from "@x502/shared/abis";

import { type DemoRuntime, writeRuntime } from "./lib/runtime.js";

// Anvil's first prefunded account. Used as deployer, repo owner, AND
// coordinator wallet (it submits requestFact and vault.payout).
const ANVIL_DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const REPO_SLUG = "skanislav/x502";
const VERIFIER_AGENT_IDS = [101n, 102n, 103n] as const;
const VERIFIER_PORTS = [9001, 9002, 9003] as const;

async function main() {
  const { values } = parseArgs({
    options: {
      "rpc-url": { type: "string" },
      "coordinator-port": { type: "string" },
      "web-port": { type: "string" },
    },
  });
  const rpcUrl = values["rpc-url"] ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const coordinatorPort = Number(values["coordinator-port"] ?? "8787");
  const webPort = Number(values["web-port"] ?? "3000");

  const deployer = privateKeyToAccount(ANVIL_DEPLOYER_KEY);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ transport, chain: foundry, pollingInterval: 200 });
  const wallet = createWalletClient({ transport, chain: foundry, account: deployer });

  process.stdout.write("[seed] deploying mocks + vault\n");
  const contracts = await deployAll(
    publicClient as unknown as PublicClient,
    wallet as unknown as WalletClient,
    deployer as Account,
  );
  process.stdout.write(`[seed]   usdc=${contracts.usdc}\n`);
  process.stdout.write(`[seed]   registry=${contracts.registry}\n`);
  process.stdout.write(`[seed]   factProvider=${contracts.factProvider}\n`);
  process.stdout.write(`[seed]   vault=${contracts.vault}\n`);

  const useSmartWallet = process.env.DEMO_SMART_WALLET === "1";

  // Optionally deploy the smart-wallet factory. We do this first so the
  // verifier-wallet preparation step can predict the third verifier's
  // contract address before registering it.
  let smartWalletFactory: Address | undefined;
  if (useSmartWallet) {
    process.stdout.write("[seed] DEMO_SMART_WALLET=1 — deploying MockSmartWalletFactory\n");
    const tx = await wallet.deployContract({
      abi: mockSmartWalletFactoryAbi,
      bytecode: mockSmartWalletFactoryBytecode,
      account: deployer as Account,
      chain: null,
    });
    const r = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (!r.contractAddress) throw new Error("factory deploy returned no address");
    smartWalletFactory = r.contractAddress;
    process.stdout.write(`[seed]   factory=${smartWalletFactory}\n`);
  }

  const verifiers: DemoRuntime["verifiers"] = [];
  for (let i = 0; i < VERIFIER_AGENT_IDS.length; i++) {
    const agentId = VERIFIER_AGENT_IDS[i]!;
    const pk = generatePrivateKey();
    const acc = privateKeyToAccount(pk);
    const isSmart = useSmartWallet && agentId === 103n;

    if (!isSmart) {
      verifiers.push({
        agentId: agentId.toString(),
        privateKey: pk,
        address: acc.address as Address,
        endpoint: `http://127.0.0.1:${VERIFIER_PORTS[i]}`,
        port: VERIFIER_PORTS[i]!,
      });
      continue;
    }

    // Smart-wallet verifier — predict the wallet's address via CREATE2 and
    // register that. The factory will deploy it when the vault hits the
    // first 6492-wrapped sig from this verifier.
    const salt = `0x${"a5".repeat(32)}` as Hex;
    const predicted = (await publicClient.readContract({
      address: smartWalletFactory!,
      abi: mockSmartWalletFactoryAbi,
      functionName: "predict",
      args: [acc.address, salt],
    } as never)) as Address;
    const factoryCalldata = encodeFunctionData({
      abi: mockSmartWalletFactoryAbi,
      functionName: "deploy",
      args: [acc.address, salt],
    });
    process.stdout.write(
      `[seed]   verifier ${agentId}: smart-wallet ${predicted} (owner ${acc.address})\n`,
    );

    verifiers.push({
      agentId: agentId.toString(),
      privateKey: pk,
      address: predicted,
      endpoint: `http://127.0.0.1:${VERIFIER_PORTS[i]}`,
      port: VERIFIER_PORTS[i]!,
      smartWallet: {
        address: predicted,
        ownerAddress: acc.address as Address,
        factory: smartWalletFactory!,
        factoryCalldata,
      },
    });
    // Suppress unused-encoder warning when smart-wallet path isn't taken.
    void encodeAbiParameters;
  }

  process.stdout.write("[seed] registering verifier wallets\n");
  for (const v of verifiers) {
    await wallet.writeContract({
      address: contracts.registry,
      abi: mockAgentRegistryAbi,
      functionName: "setAgentWallet",
      args: [BigInt(v.agentId), v.address],
      chain: null,
      account: deployer as Account,
    });
  }

  const repoId = repoIdFromSlug(REPO_SLUG);
  const prices = {
    report: parseUnits("5", 6),
    triage: parseUnits("2", 6),
    fix: parseUnits("50", 6),
    docsTests: parseUnits("30", 6),
  };
  const outcomeFee = 100_000n;
  const threshold = 2;

  process.stdout.write(`[seed] configuring repo ${REPO_SLUG}\n`);
  await wallet.writeContract({
    address: contracts.vault,
    abi: bountyVaultAbi,
    functionName: "configureRepo",
    args: [repoId, VERIFIER_AGENT_IDS, threshold, prices, outcomeFee],
    chain: null,
    account: deployer as Account,
  });

  const funding = parseUnits("200", 6);
  process.stdout.write("[seed] funding vault with 200 USDC\n");
  await wallet.writeContract({
    address: contracts.usdc,
    abi: mockUSDCAbi,
    functionName: "mint",
    args: [deployer.address, funding],
    chain: null,
    account: deployer as Account,
  });
  await wallet.writeContract({
    address: contracts.usdc,
    abi: mockUSDCAbi,
    functionName: "approve",
    args: [contracts.vault, funding],
    chain: null,
    account: deployer as Account,
  });
  await wallet.writeContract({
    address: contracts.vault,
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
    contracts,
    repo: {
      slug: REPO_SLUG,
      repoId,
      threshold,
      trustedAgentIds: VERIFIER_AGENT_IDS.map((id) => id.toString()),
    },
    verifiers,
    coordinator: { endpoint: `http://127.0.0.1:${coordinatorPort}`, port: coordinatorPort },
    web: { port: webPort },
    smartWalletFactory,
  };
  writeRuntime(rt);
  process.stdout.write("[seed] wrote demo/.runtime/addresses.json\n");
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
