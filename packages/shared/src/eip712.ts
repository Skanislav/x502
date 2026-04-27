import type { Address, Hex, TypedDataDomain } from "viem";
import type { Attestation } from "./types.js";

export const EIP712_DOMAIN_NAME = "x502" as const;
export const EIP712_DOMAIN_VERSION = "1" as const;

export const ATTESTATION_TYPES = {
  Attestation: [
    { name: "claimId", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "deadline", type: "uint256" },
    { name: "factHash", type: "bytes32" },
  ],
} as const;

export function attestationDomain(chainId: number, vault: Address): TypedDataDomain {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract: vault,
  };
}

/// Convenience: arguments suitable for viem's `signTypedData`.
export function attestationTypedData(
  chainId: number,
  vault: Address,
  att: Attestation,
): {
  domain: TypedDataDomain;
  types: typeof ATTESTATION_TYPES;
  primaryType: "Attestation";
  message: { claimId: Hex; recipient: Address; deadline: bigint; factHash: Hex };
} {
  return {
    domain: attestationDomain(chainId, vault),
    types: ATTESTATION_TYPES,
    primaryType: "Attestation",
    message: att,
  };
}
