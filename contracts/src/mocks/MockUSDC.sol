// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only USDC stand-in (6 decimals). Real USDC is EIP-3009 compliant
///         but the vault only uses transfer/transferFrom, so 3009 isn't needed here.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin (mock)", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
