import { CdpClient } from "@coinbase/cdp-sdk";
import { http, createWalletClient } from "viem";
import { toAccount } from "viem/accounts";

import type { BootstrapOptions, BootstrappedWallet, IWalletProvider } from "./types.js";

export interface CdpWalletProviderConfig {
  /// CDP API credentials. The CdpClient also reads them from process.env if
  /// you don't pass them here.
  apiKeyId?: string;
  apiKeySecret?: string;
  walletSecret?: string;
  /// Account name used as the idempotency key — same name on every boot
  /// returns the same account, so the agent's address survives restarts
  /// without us holding the private key on disk.
  accountName: string;
  /// CDP-known network for faucet + scoped helpers. Optional; signing works
  /// without it.
  network?: "base" | "base-sepolia" | "ethereum-sepolia";
  /// Auto-request testnet USDC + ETH on first run.
  faucet?: boolean;
}

/// Wallet backend that bootstraps a Coinbase-managed EVM EOA via CDP and
/// returns a viem-compatible Account that signs through CDP. EOA path
/// produces vanilla ECDSA sigs, so the vault's existing
/// SignatureChecker.isValidSignatureNow path works with no contract change.
///
/// See `IWalletProvider` for the interface. ServerAccount type from CDP
/// already exposes viem-shaped signMessage / signTransaction / signTypedData,
/// so `viem/accounts.toAccount` happily wraps it.
export class CdpWalletProvider implements IWalletProvider {
  private cdp: CdpClient;

  constructor(private readonly cfg: CdpWalletProviderConfig) {
    this.cdp = new CdpClient({
      apiKeyId: cfg.apiKeyId,
      apiKeySecret: cfg.apiKeySecret,
      walletSecret: cfg.walletSecret,
    });
  }

  async bootstrap(opts: BootstrapOptions): Promise<BootstrappedWallet> {
    // Idempotent: the second boot with the same `name` returns the same
    // server-managed account.
    const cdpAccount = await this.cdp.evm.getOrCreateAccount({ name: this.cfg.accountName });

    if (this.cfg.faucet && this.cfg.network && this.cfg.network !== "base") {
      try {
        const networkAccount = await cdpAccount.useNetwork(this.cfg.network);
        if (typeof (networkAccount as { requestFaucet?: unknown }).requestFaucet === "function") {
          await (
            networkAccount as unknown as {
              requestFaucet: (o: { token: "eth" | "usdc" }) => Promise<unknown>;
            }
          ).requestFaucet({ token: "eth" });
        }
      } catch {
        // Faucet is best-effort; bootstrap doesn't fail if the well's dry.
      }
    }

    // Wrap as a viem Account. The CDP account's signers already match viem's
    // shape — we just give it the LocalAccount type so `createWalletClient`
    // accepts it.
    const account = toAccount({
      address: cdpAccount.address,
      signMessage: cdpAccount.signMessage.bind(cdpAccount),
      signTransaction: cdpAccount.signTransaction.bind(cdpAccount),
      signTypedData: cdpAccount.signTypedData.bind(cdpAccount),
    });
    const walletClient = createWalletClient({
      account,
      chain: opts.chain,
      transport: http(opts.rpcUrl),
    });

    return {
      account,
      walletClient,
      agentId: opts.agentId,
      address: cdpAccount.address,
      source: "cdp",
    };
  }
}
