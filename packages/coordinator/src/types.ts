import type { Kind } from "@x502/shared";
import type { Address, Hex } from "viem";

export type ClaimStatus = "verifying" | "ready" | "paid" | "failed";

export interface ClaimRequestBody {
  repoSlug: string;
  externalId: bigint;
  kind: Kind;
  recipient: Address;
  agentIdReveal?: bigint;
  saltReveal?: Hex;
}

export interface ClaimState {
  claimId: Hex;
  repoId: Hex;
  request: ClaimRequestBody;
  deadline: bigint;
  status: ClaimStatus;
  factHash?: Hex;
  factBlob?: Hex;
  /// EAS attestation UIDs collected for this claim (one per attester),
  /// trimmed to threshold and sorted by attester address before being
  /// passed to vault.payout.
  attestationUIDs: Hex[];
  txHash?: Hex;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
