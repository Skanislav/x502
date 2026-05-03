// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice EIP-712 typehashes and struct hashing for x502 verifier attestations.
library Attestations {
    /// @dev keccak256("Attestation(bytes32 claimId,address recipient,uint256 deadline,bytes32 factHash)")
    bytes32 internal constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(bytes32 claimId,address recipient,uint256 deadline,bytes32 factHash)"
    );

    struct Attestation {
        bytes32 claimId;
        address recipient;
        uint256 deadline;
        bytes32 factHash;
    }

    function hashStruct(Attestation memory a) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(ATTESTATION_TYPEHASH, a.claimId, a.recipient, a.deadline, a.factHash)
            );
    }

    /// @notice Canonical claimId derivation. Same logic must live in TS shared package.
    function claimId(bytes32 repoId, uint256 externalId, uint8 kind)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(repoId, externalId, kind));
    }
}
