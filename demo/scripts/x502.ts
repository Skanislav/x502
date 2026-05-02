/// CLI helper for the x502-verify Claude skill. Two subcommands:
///
///   tsx demo/scripts/x502.ts pending --coordinator URL --agent-id N
///     → prints JSON: { agentId, pending: [{ claimId, repoSlug, externalId,
///                                          kind, recipient, deadline,
///                                          factHash, agentIdReveal?,
///                                          saltReveal? }] }
///
///   tsx demo/scripts/x502.ts attest \
///     --rpc URL --eas 0x.. --schema 0x.. --scope-id KEY \
///     --claim-id 0x.. --fact-hash 0x.. --chain-id 31337 \
///     [--reject]
///     → publishes an EAS attestation under the x502 schema with
///       (claimId, factHash, accept). Prints the new UID + tx hash.
///       The coordinator's EAS watcher picks it up and threads it into
///       the pending payout.
///
/// Local mode (1claw): the scope id is the env-var name holding a 0x-hex
/// private key. The skill helper signs no typed data — EAS records the
/// attestation on chain; the vault validates from the registry.

import { parseArgs } from "node:util";
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  isAddress,
  isHex,
} from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

import { oneClawAccount, pickOneClawFromEnv } from "@x502/shared";
import { mockEASAbi } from "@x502/shared/abis";

function chainFromId(id: number) {
  if (id === base.id) return base;
  if (id === baseSepolia.id) return baseSepolia;
  if (id === foundry.id) return foundry;
  throw new Error(`unsupported chainId ${id}`);
}

async function cmdPending(rest: string[]): Promise<void> {
  const { values } = parseArgs({
    args: rest,
    options: {
      coordinator: { type: "string" },
      "agent-id": { type: "string" },
    },
  });
  const coordinator = values.coordinator ?? process.env.X502_COORDINATOR ?? "http://127.0.0.1:8787";
  const agentId = values["agent-id"];
  if (!agentId) throw new Error("--agent-id required");

  const r = await fetch(`${coordinator}/pending-claims/${agentId}`);
  if (!r.ok) throw new Error(`coordinator ${r.status}: ${await r.text()}`);
  const j = await r.json();
  process.stdout.write(`${JSON.stringify(j, null, 2)}\n`);
}

async function cmdAttest(rest: string[]): Promise<void> {
  const { values } = parseArgs({
    args: rest,
    options: {
      rpc: { type: "string" },
      eas: { type: "string" },
      schema: { type: "string" },
      "scope-id": { type: "string" },
      "claim-id": { type: "string" },
      "fact-hash": { type: "string" },
      "chain-id": { type: "string" },
      reject: { type: "boolean" },
    },
  });

  const rpc = values.rpc ?? process.env.X502_RPC ?? "http://127.0.0.1:8545";
  const easAddress = (values.eas ?? process.env.X502_EAS) as Address | undefined;
  const schemaUID = (values.schema ?? process.env.X502_SCHEMA_UID) as Hex | undefined;
  const scopeId = req(values, "scope-id");
  const claimId = req(values, "claim-id") as Hex;
  const factHash = req(values, "fact-hash") as Hex;
  const chainId = Number(values["chain-id"] ?? process.env.X502_CHAIN_ID ?? "31337");
  const accept = !values.reject;

  if (!easAddress || !isAddress(easAddress))
    throw new Error("--eas / X502_EAS required (0x-address)");
  if (!schemaUID || !isHex(schemaUID) || schemaUID.length !== 66)
    throw new Error("--schema / X502_SCHEMA_UID required (bytes32)");
  if (!isHex(claimId) || claimId.length !== 66) throw new Error("--claim-id must be bytes32 hex");
  if (!isHex(factHash) || factHash.length !== 66)
    throw new Error("--fact-hash must be bytes32 hex");

  const chain = chainFromId(chainId);
  const oneClaw = pickOneClawFromEnv(process.env);
  const scope = await oneClaw.resolveScope(scopeId);
  const account = oneClawAccount(oneClaw, scopeId, scope.address);
  const transport = http(rpc);
  const publicClient = createPublicClient({ transport, chain, pollingInterval: 200 });
  const walletClient = createWalletClient({ transport, chain, account });

  const data = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "bytes32" }, { type: "bool" }],
    [claimId, factHash, accept],
  );

  const { request } = await publicClient.simulateContract({
    address: easAddress,
    abi: mockEASAbi,
    functionName: "attest",
    args: [
      {
        schema: schemaUID,
        data: {
          recipient: "0x0000000000000000000000000000000000000000" as Address,
          expirationTime: 0n,
          revocable: true,
          refUID: `0x${"00".repeat(32)}` as Hex,
          data,
          value: 0n,
        },
      },
    ],
    account,
  });
  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Find the Attested event to recover the UID. EAS emits it with topic
  // signature `Attested(address,address,bytes32,bytes32)`.
  let uid: Hex | undefined;
  for (const log of receipt.logs as unknown as Array<{
    address: Address;
    data: Hex;
    topics: Hex[];
  }>) {
    if (log.address.toLowerCase() !== easAddress.toLowerCase()) continue;
    try {
      const parsed = decodeEventLog({
        abi: mockEASAbi,
        data: log.data,
        topics: log.topics as [signature: Hex, ...args: Hex[]],
      }) as { eventName: string; args: { uid?: Hex } };
      if (parsed.eventName === "Attested" && parsed.args.uid) {
        uid = parsed.args.uid;
        break;
      }
    } catch {
      /* not the event we want */
    }
  }
  if (!uid) throw new Error("Attested event not found in receipt");

  process.stdout.write(
    `${JSON.stringify({ uid, txHash, accept, attester: scope.address }, null, 2)}\n`,
  );
}

function req(values: Record<string, string | boolean | undefined>, key: string): string {
  const v = values[key];
  if (typeof v !== "string" || !v) throw new Error(`--${key} required`);
  return v;
}

async function main() {
  const [, , subcommand, ...rest] = process.argv;
  switch (subcommand) {
    case "pending":
      await cmdPending(rest);
      break;
    case "attest":
      await cmdAttest(rest);
      break;
    default:
      process.stderr.write("usage: x502.ts {pending|attest} [...flags]\n");
      process.exit(2);
  }
}

main().catch((e) => {
  process.stderr.write(`x502: ${(e as Error).message}\n`);
  process.exit(1);
});
