// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {MockSmartWallet} from "./MockSmartWallet.sol";

/// @notice CREATE2 factory for `MockSmartWallet`. `predict` returns the
///         address that `deploy(owner, salt)` will produce, so the demo (and
///         the ERC-6492 contract tests) can register the wallet's address
///         before any deployment happens — the vault's
///         `ERC6492SignatureChecker` then deploys it during the first
///         payout that includes a 6492-wrapped sig.
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
