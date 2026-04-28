import { deriveCommitment, repoIdFromSlug } from "@x502/shared";
import type { Hex } from "viem";
import type { PollResponse } from "./coordinator";

export interface PipelineState {
  claimId?: Hex;
  status: "idle" | "verifying" | "ready" | "paid" | "failed";
  error?: string;
  txHash?: Hex;
  factReady?: boolean;
  sigs?: number;
}

export function mapPoll(claimId: Hex, body: PollResponse): PipelineState {
  if (body.status === "paid") return { claimId, status: "paid", txHash: body.txHash };
  if (body.status === "failed") return { claimId, status: "failed", error: body.error };
  return { claimId, status: body.status, factReady: body.factReady, sigs: body.sigs };
}

export function previewCommitment(args: {
  repoSlug: string;
  externalId: string;
  agentIdReveal: string;
  saltReveal: string;
}): Hex | undefined {
  if (!args.repoSlug.includes("/")) return undefined;
  if (!args.externalId || !args.agentIdReveal || !args.saltReveal.startsWith("0x"))
    return undefined;
  try {
    return deriveCommitment(
      BigInt(args.agentIdReveal),
      repoIdFromSlug(args.repoSlug),
      BigInt(args.externalId),
      args.saltReveal as Hex,
    );
  } catch {
    return undefined;
  }
}
