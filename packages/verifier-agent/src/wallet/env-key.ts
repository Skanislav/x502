import { http, type Hex, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { BootstrapOptions, BootstrappedWallet, IWalletProvider } from "./types.js";

/// Wallet backend that reads a raw private key from env. The original pattern;
/// preserved as a fallback for tests, CI, and operators who want full custody.
export class EnvKeyWalletProvider implements IWalletProvider {
  constructor(private readonly privateKey: Hex) {}

  async bootstrap(opts: BootstrapOptions): Promise<BootstrappedWallet> {
    const account = privateKeyToAccount(this.privateKey);
    const walletClient = createWalletClient({
      account,
      chain: opts.chain,
      transport: http(opts.rpcUrl),
    });
    return {
      account,
      walletClient,
      agentId: opts.agentId,
      address: account.address,
      source: "envkey",
    };
  }
}
