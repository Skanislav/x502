// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice Minimal ERC-1271 smart wallet, deployable by the demo via the
///         companion `MockSmartWalletFactory`. Wraps an EOA `owner`:
///         `isValidSignature(hash, sig)` returns the ERC-1271 magic value
///         when `sig` is a valid ECDSA signature from `owner`.
///
///         Used by both the contracts test suite (deployed + counterfactual
///         ERC-6492 flows) and the local demo (so we can ship a smart-wallet
///         verifier end-to-end without depending on a third-party factory).
contract MockSmartWallet {
    /// @dev bytes4(keccak256("isValidSignature(bytes32,bytes)"))
    bytes4 internal constant ERC1271_MAGIC = 0x1626ba7e;

    address public immutable owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4)
    {
        if (SignatureChecker.isValidSignatureNow(owner, hash, signature)) {
            return ERC1271_MAGIC;
        }
        return 0xffffffff;
    }
}
