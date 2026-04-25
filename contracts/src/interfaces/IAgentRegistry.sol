// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal subset of ERC-8004 IdentityRegistry needed by the vault.
/// @dev Real Base Sepolia deployment: 0x8004A818BFB912233c491871b3d84c89A494BD9e
interface IAgentRegistry {
    /// @notice Operational signer wallet bound to an agent ID.
    /// @dev May be a smart-contract wallet; vault must verify with EIP-1271-aware checker.
    function getAgentWallet(uint256 agentId) external view returns (address);
}
