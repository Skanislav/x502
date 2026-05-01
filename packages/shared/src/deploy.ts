import type { Account, Address, Hex, PublicClient, WalletClient } from "viem";

import {
  bountyVaultAbi,
  bountyVaultBytecode,
  mockAgentRegistryAbi,
  mockAgentRegistryBytecode,
  mockGitHubFactProviderAbi,
  mockGitHubFactProviderBytecode,
  mockUSDCAbi,
  mockUSDCBytecode,
} from "./abis.js";

export interface DeployedContracts {
  usdc: Address;
  registry: Address;
  factProvider: Address;
  vault: Address;
}

async function deploy(
  publicClient: PublicClient,
  wallet: WalletClient,
  account: Account,
  abi: readonly unknown[],
  bytecode: Hex,
  args: readonly unknown[] = [],
): Promise<Address> {
  const tx = await wallet.deployContract({
    abi: abi as never,
    bytecode,
    args: args as never,
    account,
    chain: null,
  });
  const r = await publicClient.waitForTransactionReceipt({ hash: tx });
  if (!r.contractAddress) throw new Error(`deploy returned no address (tx=${tx})`);
  return r.contractAddress;
}

/// Deploys MockUSDC + MockAgentRegistry + MockGitHubFactProvider + BountyVault
/// to the chain backing `publicClient`. All four contracts are bytecode-only
/// (no Foundry required); the bytecode is checked in via `@x502/shared/abis`.
export async function deployAll(
  publicClient: PublicClient,
  wallet: WalletClient,
  account: Account,
): Promise<DeployedContracts> {
  const usdc = await deploy(publicClient, wallet, account, mockUSDCAbi, mockUSDCBytecode);
  const registry = await deploy(
    publicClient,
    wallet,
    account,
    mockAgentRegistryAbi,
    mockAgentRegistryBytecode,
  );
  const factProvider = await deploy(
    publicClient,
    wallet,
    account,
    mockGitHubFactProviderAbi,
    mockGitHubFactProviderBytecode,
  );
  const vault = await deploy(publicClient, wallet, account, bountyVaultAbi, bountyVaultBytecode, [
    usdc,
    registry,
    factProvider,
  ]);
  return { usdc, registry, factProvider, vault };
}
