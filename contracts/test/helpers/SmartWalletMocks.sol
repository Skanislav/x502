// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Factory variant that "succeeds" (no revert) but doesn't actually
///         deploy any code. Used to test the ERC-6492 negative path —
///         `signer.code.length == 0` after the factory call must reject.
///         Test-only; lives here rather than in `src/mocks/` because nothing
///         outside the test suite deploys it.
contract NoOpSmartWalletFactory {
    function deploy(address, bytes32) external pure returns (address) {
        return address(0);
    }
}
