// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice Minimal ERC-1271 smart wallet for tests. Wraps an EOA owner —
///         `isValidSignature(hash, sig)` returns the magic value if `sig` is a
///         valid ECDSA signature from `owner`. Deployed via CREATE2 by the
///         companion factory so its address is predictable for ERC-6492
///         counterfactual flows.
contract MockSmartWallet {
    /// @dev keccak256("isValidSignature(bytes32,bytes)") truncated to 4 bytes.
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

/// @notice CREATE2 factory for `MockSmartWallet`. `predict` returns the
///         address that `deploy(owner, salt)` will produce, so tests can
///         register the wallet's address before any deployment happens.
contract MockSmartWalletFactory {
    function deploy(address owner, bytes32 salt) external returns (address) {
        return address(new MockSmartWallet{salt: salt}(owner));
    }

    function predict(address owner, bytes32 salt) external view returns (address) {
        bytes memory creationCode =
            abi.encodePacked(type(MockSmartWallet).creationCode, abi.encode(owner));
        bytes32 codeHash = keccak256(creationCode);
        bytes32 h = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, codeHash));
        return address(uint160(uint256(h)));
    }
}

/// @notice Factory variant that "succeeds" (no revert) but doesn't actually
///         deploy any code. Used to test the ERC-6492 negative path —
///         `signer.code.length == 0` after the factory call must reject.
contract NoOpSmartWalletFactory {
    function deploy(address, bytes32) external pure returns (address) {
        return address(0);
    }
}
