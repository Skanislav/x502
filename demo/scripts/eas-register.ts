/// Standalone helper to register the x502 schema in EAS's SchemaRegistry.
/// Idempotent — if the schema is already registered with the same params,
/// reads its existing UID instead. Prints the UID to stdout so deploy
/// pipelines can capture it for the vault constructor.
///
///   tsx demo/scripts/eas-register.ts \
///     --rpc https://sepolia.base.org \
///     --scope-id DEPLOYER_PRIVATE_KEY \
///     [--registry 0x4200000000000000000000000000000000000020]
///
/// 1claw local mode reads the deployer key from the env var named by
/// --scope-id. Production deploys can run this once per chain and bake the
/// resulting UID into Deploy.s.sol's X502_SCHEMA_UID env.

import { parseArgs } from "node:util";
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodePacked,
  isAddress,
  keccak256,
} from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

import { X502_SCHEMA, oneClawAccount, pickOneClawFromEnv } from "@x502/shared";

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

function chainFromId(id: number) {
  if (id === base.id) return base;
  if (id === baseSepolia.id) return baseSepolia;
  if (id === foundry.id) return foundry;
  throw new Error(`unsupported chainId ${id}`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      rpc: { type: "string" },
      "scope-id": { type: "string" },
      registry: { type: "string" },
      "chain-id": { type: "string" },
    },
  });
  const rpc = values.rpc ?? process.env.BASE_SEPOLIA_RPC_URL;
  if (!rpc) throw new Error("--rpc / BASE_SEPOLIA_RPC_URL required");
  const scopeId = values["scope-id"];
  if (!scopeId) throw new Error("--scope-id required (env-var name holding deployer key)");
  const registryAddr = (values.registry ?? SCHEMA_REGISTRY_PREDEPLOY) as Address;
  if (!isAddress(registryAddr)) throw new Error("--registry must be a 0x-address");
  const chainId = Number(values["chain-id"] ?? "84532");
  const chain = chainFromId(chainId);

  const expectedUID = keccak256(
    encodePacked(
      ["string", "address", "bool"],
      [X502_SCHEMA, "0x0000000000000000000000000000000000000000" as Address, true],
    ),
  );

  const oneClaw = pickOneClawFromEnv(process.env);
  const scope = await oneClaw.resolveScope(scopeId);
  const account = oneClawAccount(oneClaw, scopeId, scope.address);
  const transport = http(rpc);
  const publicClient = createPublicClient({ transport, chain, pollingInterval: 200 });
  const walletClient = createWalletClient({ transport, chain, account });

  const existing = (await publicClient.readContract({
    address: registryAddr,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "getSchema",
    args: [expectedUID],
  } as never)) as { uid: Hex };

  if (existing.uid === expectedUID) {
    process.stdout.write(`${JSON.stringify({ uid: expectedUID, registered: false }, null, 2)}\n`);
    return;
  }

  const txHash = await walletClient.writeContract({
    address: registryAddr,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "register",
    args: [X502_SCHEMA, "0x0000000000000000000000000000000000000000" as Address, true],
    chain: null,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  process.stdout.write(
    `${JSON.stringify({ uid: expectedUID, registered: true, txHash }, null, 2)}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`eas-register: ${(e as Error).message}\n`);
  process.exit(1);
});
