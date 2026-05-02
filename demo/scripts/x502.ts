/// CLI helper for the x502-verify Claude skill. Two subcommands:
///
///   tsx demo/scripts/x502.ts pending --coordinator URL --agent-id N
///     → prints JSON: { agentId, pending: [{ claimId, repoSlug, externalId,
///                                          kind, recipient, deadline,
///                                          factHash, agentIdReveal?, saltReveal? }] }
///
///   tsx demo/scripts/x502.ts attest \
///     --coordinator URL --agent-id N --scope-id KEY \
///     [--smart-wallet ADDRESS --smart-factory ADDRESS --smart-calldata 0x..] \
///     --claim-id 0x.. --recipient 0x.. --deadline 1234 --fact-hash 0x.. \
///     --vault 0x.. --chain-id 31337
///     → signs an EIP-712 attestation (1claw local mode reads the key from
///       env), POSTs to the coordinator, prints the response JSON.
///
/// The Claude skill (.claude/skills/x502-verify/SKILL.md) drives this
/// helper. Local mode reads private keys from env (the scope id is the
/// env-var name) so no secrets land on disk.

import { parseArgs } from "node:util";
import { http, type Address, type Hex, createWalletClient, isAddress } from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

import {
  type SmartWalletWrap,
  oneClawAccount,
  pickOneClawFromEnv,
  signAttestation,
} from "@x502/shared";

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
  const coordinator = values.coordinator ?? "http://127.0.0.1:8787";
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
      coordinator: { type: "string" },
      "agent-id": { type: "string" },
      "scope-id": { type: "string" },
      "claim-id": { type: "string" },
      recipient: { type: "string" },
      deadline: { type: "string" },
      "fact-hash": { type: "string" },
      vault: { type: "string" },
      "chain-id": { type: "string" },
      "smart-wallet": { type: "string" },
      "smart-factory": { type: "string" },
      "smart-calldata": { type: "string" },
    },
  });

  const coordinator = values.coordinator ?? "http://127.0.0.1:8787";
  const agentId = BigInt(req(values, "agent-id"));
  const scopeId = req(values, "scope-id");
  const claimId = req(values, "claim-id") as Hex;
  const recipient = req(values, "recipient") as Address;
  const deadline = BigInt(req(values, "deadline"));
  const factHash = req(values, "fact-hash") as Hex;
  const vault = req(values, "vault") as Address;
  const chainId = Number(values["chain-id"] ?? "31337");
  const chain = chainFromId(chainId);

  if (!isAddress(recipient)) throw new Error("--recipient must be 0x-address");
  if (!isAddress(vault)) throw new Error("--vault must be 0x-address");

  let smartWallet: SmartWalletWrap | undefined;
  if (values["smart-wallet"] || values["smart-factory"] || values["smart-calldata"]) {
    const addr = values["smart-wallet"];
    const factory = values["smart-factory"];
    const calldata = values["smart-calldata"];
    if (!addr || !factory || !calldata) {
      throw new Error("smart-wallet flags must be set together (or none of them)");
    }
    smartWallet = {
      address: addr as Address,
      factory: factory as Address,
      factoryCalldata: calldata as Hex,
    };
  }

  const oneClaw = pickOneClawFromEnv(process.env);
  const scope = await oneClaw.resolveScope(scopeId);
  const account = oneClawAccount(oneClaw, scopeId, scope.address);
  const walletClient = createWalletClient({ chain, transport: http(), account });

  const signed = await signAttestation(
    {
      agentId,
      vault,
      chainId,
      account,
      wallet: walletClient,
      smartWallet,
    },
    { claimId, recipient, deadline, factHash },
  );

  const body = {
    claimId,
    agentId: agentId.toString(),
    signature: signed.signature,
    attestation: {
      claimId,
      recipient,
      deadline: deadline.toString(),
      factHash,
    },
  };
  const r = await fetch(`${coordinator}/attestation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  process.stdout.write(`status=${r.status}\n${text}\n`);
  if (!r.ok) process.exit(1);
}

function req(values: Record<string, string | undefined>, key: string): string {
  const v = values[key];
  if (!v) throw new Error(`--${key} required`);
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
