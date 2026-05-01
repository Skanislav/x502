// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice ERC-6492 wrapper around OZ's `SignatureChecker.isValidSignatureNow`.
///         Adds support for signatures from counterfactual (undeployed) smart
///         accounts: when the signature ends in the EIP-6492 magic suffix the
///         wallet is deployed via the embedded factory call, then the standard
///         ERC-1271 / ECDSA check runs. Bare signatures fall through unchanged
///         so EOA + already-deployed smart-account signers keep working.
///
///         The library is `internal` only — it inlines into the calling
///         contract, no separate deployment.
///
///         Trust model: the factory address is part of the signature blob, so
///         a malicious factory can only burn the caller's gas. After running
///         it we re-check `signer.code.length > 0` and then re-verify via
///         `isValidSignatureNow`, which only returns true if the deployed
///         contract correctly implements ERC-1271 against `signer`.
library ERC6492SignatureChecker {
    /// @dev EIP-6492 magic suffix: keccak256("6492") truncated, repeated.
    bytes32 internal constant ERC6492_MAGIC =
        0x6492649264926492649264926492649264926492649264926492649264926492;

    /// @dev Non-view: the deployment branch issues a CALL to the factory.
    ///      Callers must already be in a non-view context (BountyVault.payout
    ///      is `nonReentrant`, which protects against the factory calling
    ///      back into the vault).
    function isValidSig(address signer, bytes32 hash, bytes calldata signature)
        internal
        returns (bool)
    {
        if (signature.length >= 32) {
            bytes32 tail = bytes32(signature[signature.length - 32:]);
            if (tail == ERC6492_MAGIC) {
                (address factory, bytes memory factoryCalldata, bytes memory innerSig) =
                    abi.decode(signature[:signature.length - 32], (address, bytes, bytes));

                if (signer.code.length == 0) {
                    (bool ok,) = factory.call(factoryCalldata);
                    // Both `ok=false` and "factory ran but didn't deploy at
                    // the predicted address" are rejected. The attacker has
                    // already paid for the gas at this point.
                    if (!ok || signer.code.length == 0) return false;
                }
                return SignatureChecker.isValidSignatureNow(signer, hash, innerSig);
            }
        }
        return SignatureChecker.isValidSignatureNow(signer, hash, signature);
    }
}
