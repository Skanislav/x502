import type { Account, Chain, WalletClient } from "viem";

/// What every wallet backend has to produce.
export interface BootstrappedWallet {
  /// viem Account suitable for `createWalletClient({ account })`. EOA or
  /// CDP-managed; vault verifies via `SignatureChecker.isValidSignatureNow`
  /// so both flows work without contract changes.
  account: Account;
  walletClient: WalletClient;
  /// ERC-8004 token id this wallet represents. The repo owner adds this
  /// agentId to `BountyVault.configureRepo`'s trustedAgents.
  agentId: bigint;
  /// Convenience: same as account.address. Mostly for logging.
  address: `0x${string}`;
  /// Provenance string for /health output ("envkey" / "cdp").
  source: string;
}

export interface BootstrapOptions {
  chain: Chain;
  rpcUrl?: string;
  agentId: bigint;
}

export interface IWalletProvider {
  bootstrap(opts: BootstrapOptions): Promise<BootstrappedWallet>;
}
