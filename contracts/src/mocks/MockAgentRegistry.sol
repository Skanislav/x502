// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAgentRegistry} from "../interfaces/IAgentRegistry.sol";

/// @notice Spec-compatible stub of the ERC-8004 IdentityRegistry surface used by
///         BountyVault. Real Base-Sepolia deployment exposes the same
///         `getAgentWallet(uint256)` selector, so the vault wires identically
///         against either.
contract MockAgentRegistry is IAgentRegistry {
    mapping(uint256 => address) private _wallet;

    function setAgentWallet(uint256 agentId, address wallet) external {
        _wallet[agentId] = wallet;
    }

    function getAgentWallet(uint256 agentId) external view override returns (address) {
        return _wallet[agentId];
    }
}
