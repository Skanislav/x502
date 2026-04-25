import type { Address, Hex } from "viem";

/// Mirrors `BountyVault.Kind` enum.
export const Kind = {
  Report: 0,
  Triage: 1,
  Fix: 2,
  DocsTests: 3,
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

export const KindName = {
  [Kind.Report]: "report",
  [Kind.Triage]: "triage",
  [Kind.Fix]: "fix",
  [Kind.DocsTests]: "docs_tests",
} as const;

export type KindName = (typeof KindName)[Kind];

export interface Attestation {
  claimId: Hex;
  recipient: Address;
  deadline: bigint;
  factHash: Hex;
}

export interface SignedAttestation {
  attestation: Attestation;
  signature: Hex;
  agentId: bigint;
}

export interface ClaimRequest {
  repoId: Hex; // bytes32
  externalId: bigint; // GH issue or PR number
  kind: Kind;
  recipient: Address;
  /// The reveal of the commitment posted in the GH body. Verifier checks
  /// keccak256(agentId || repoId || externalId || salt) matches the comment.
  agentIdReveal?: bigint;
  saltReveal?: Hex;
}

export interface FactBlob {
  /// Status code: 0 = invalid, 1 = valid for this kind.
  status: number;
  /// Block (or PR/issue) timestamp / mergedBlock for `fix`/`docs_tests`.
  mergedBlock: bigint;
  /// Bitmask of GH labels matched (e.g. accepted, bug, triage-done).
  labelMask: Hex;
  /// Wallet address bound to the GH author via the commitment in the body.
  ghAuthorBinding: Address;
}
