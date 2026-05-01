import type { Address } from "viem";

import { mockAgentRegistryAbi } from "./abis.js";

/// ABI-compatible subset of the ERC-8004 / mock IdentityRegistry interface.
/// We only need `getAgentWallet`; both the on-chain canonical contract and the
/// MockAgentRegistry expose this function with the same selector.
export const agentRegistryAbi = mockAgentRegistryAbi;

/// Structural shape — accepts any viem PublicClient (or compatible) without
/// pulling viem's full generic surface into shared's type signatures. Strict
/// viem inference makes a concrete `PublicClient` reject clients whose
/// `account` field is narrowed differently, so we keep this loose here.
export interface AgentRegistryClient {
  client: {
    readContract: (args: {
      address: Address;
      abi: typeof mockAgentRegistryAbi;
      functionName: "getAgentWallet";
      args: readonly [bigint];
    }) => Promise<unknown>;
  };
  address: Address;
}

/// Resolves an ERC-8004 agentId to its bound wallet address. Cheap on-chain
/// view call; consumers that issue many lookups should add their own cache.
export async function resolveAgentWallet(
  registry: AgentRegistryClient,
  agentId: bigint,
): Promise<Address> {
  return (await registry.client.readContract({
    address: registry.address,
    abi: agentRegistryAbi,
    functionName: "getAgentWallet",
    args: [agentId],
  })) as Address;
}
