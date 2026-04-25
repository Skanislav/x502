import { encodeAbiParameters, keccak256, type Hex } from "viem";
import type { Kind } from "./types.js";

/// Canonical claimId derivation. Must stay in lockstep with
/// contracts/src/lib/Attestations.sol::claimId.
export function deriveClaimId(repoId: Hex, externalId: bigint, kind: Kind): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }, { type: "uint8" }],
      [repoId, externalId, kind],
    ),
  );
}

/// Canonical commitment for the GH-body proof:
///   keccak256(agentId || repoId || externalId || salt)
export function deriveCommitment(
  agentId: bigint,
  repoId: Hex,
  externalId: bigint,
  salt: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "bytes32" }, { type: "uint256" }, { type: "bytes32" }],
      [agentId, repoId, externalId, salt],
    ),
  );
}

/// Canonical repoId from "owner/repo" string.
export function repoIdFromSlug(slug: string): Hex {
  return keccak256(new TextEncoder().encode(`github.com/${slug}`));
}
