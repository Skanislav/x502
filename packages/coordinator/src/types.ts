import type { Address, Hex } from "viem";
import type { Kind, SignedAttestation } from "@x502/shared";

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
  attestations: SignedAttestation[];
  txHash?: Hex;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
