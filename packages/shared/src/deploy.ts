import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  keccak256,
  toBytes,
} from "viem";

import {
  bountyVaultAbi,
  bountyVaultBytecode,
  mockAgentRegistryAbi,
  mockAgentRegistryBytecode,
  mockEASAbi,
  mockEASBytecode,
  mockGitHubFactProviderAbi,
  mockGitHubFactProviderBytecode,
  mockUSDCAbi,
  mockUSDCBytecode,
} from "./abis.js";

export interface DeployedContracts {
  usdc: Address;
  registry: Address;
  factProvider: Address;
  /// EAS contract — MockEAS in local mode, the real predeploy address when
  /// running against a Base Sepolia fork.
  eas: Address;
  /// Schema UID under which verifiers attest. The vault rejects attestations
  /// from any other schema.
  schemaUID: Hex;
  vault: Address;
}

/// Canonical schema string for x502 verifier attestations. The on-chain
/// schemaUID derives from this in EAS's SchemaRegistry; for MockEAS we just
/// hash it deterministically so unit tests + local demo agree.
export const X502_SCHEMA = "bytes32 claimId,bytes32 factHash,bool accept";

/// MockEAS-friendly schema UID derivation. Real EAS uses
/// `keccak256(abi.encodePacked(schema, resolver, revocable))`; for the
/// local demo we collapse to keccak256(schema) so we don't have to register
/// the schema in the mock.
export const X502_LOCAL_SCHEMA_UID: Hex = keccak256(toBytes(`x502:${X502_SCHEMA}`));

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

/// Deploys MockUSDC + MockAgentRegistry + MockGitHubFactProvider + MockEAS +
/// BountyVault to the chain backing `publicClient`. Used by the local demo
/// (anvil) and by tests. When the demo runs against a Base Sepolia fork,
/// callers should NOT call this — instead they pass the real EAS predeploy
/// address + the schemaUID returned by EAS's SchemaRegistry.
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
  const eas = await deploy(publicClient, wallet, account, mockEASAbi, mockEASBytecode);
  const schemaUID = X502_LOCAL_SCHEMA_UID;
  const vault = await deploy(publicClient, wallet, account, bountyVaultAbi, bountyVaultBytecode, [
    usdc,
    registry,
    factProvider,
    eas,
    schemaUID,
  ]);
  return { usdc, registry, factProvider, eas, schemaUID, vault };
}
