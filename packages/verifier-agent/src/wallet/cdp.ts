import { CdpClient } from "@coinbase/cdp-sdk";
import { http, type Hex, type TypedData, type TypedDataDefinition, createWalletClient } from "viem";
import { toAccount } from "viem/accounts";

import type { BootstrapOptions, BootstrappedWallet, IWalletProvider } from "./types.js";

export type CdpWalletMode = "eoa" | "smart";
export type CdpKnownNetwork = "base" | "base-sepolia" | "ethereum-sepolia";

export interface CdpWalletProviderConfig {
  /// CDP API credentials. The CdpClient also reads them from process.env if
  /// you don't pass them here.
  apiKeyId?: string;
  apiKeySecret?: string;
  walletSecret?: string;
  /// "smart" (default) — Coinbase Smart Wallet via ERC-1271. The vault verifies
  /// with OZ's SignatureChecker.isValidSignatureNow which calls the wallet's
  /// `isValidSignature(digest, sig)` over staticcall.
  ///
  /// IMPORTANT: the smart wallet must be DEPLOYED before the first claim is
  /// settled — `isValidSignatureNow` returns false against a counterfactual
  /// (no code) address. Either send one userOp from the wallet beforehand
  /// (e.g. transfer dust) or upgrade the vault to `isValidERC6492SignatureNow`
  /// for auto-deploy on verify.
  ///
  /// "eoa" — vanilla ECDSA. Simpler to demo (no deploy step) but loses the
  /// spend-controls/session-keys/sponsored-gas knobs the smart wallet gets.
  mode?: CdpWalletMode;
  /// Account name used as the idempotency key — same name on every boot
  /// returns the same account, so the agent's address survives restarts
  /// without us holding the private key on disk.
  accountName: string;
  /// Network for the smart account's userOps + faucet. Required for `smart`,
  /// optional for `eoa` (signing works without network scope on EOA).
  network?: CdpKnownNetwork;
  /// Auto-request testnet ETH on first run.
  faucet?: boolean;
}

/// Wallet backend backed by Coinbase Developer Platform. Two modes:
///
/// - `smart` (default): bootstraps a Coinbase Smart Wallet whose owner is a
///   CDP-managed EOA. The agent address is the smart-wallet contract; sigs
///   are ERC-1271 verified by the vault.
/// - `eoa`: legacy server-managed EOA path, ECDSA-only.
///
/// Both expose the same viem-Account shape so `buildVerifierApp` doesn't care.
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
    const mode: CdpWalletMode = this.cfg.mode ?? "smart";
    return mode === "smart" ? this.bootstrapSmart(opts) : this.bootstrapEoa(opts);
  }

  private async bootstrapEoa(opts: BootstrapOptions): Promise<BootstrappedWallet> {
    const cdpAccount = await this.cdp.evm.getOrCreateAccount({ name: this.cfg.accountName });

    if (this.cfg.faucet && this.cfg.network && this.cfg.network !== "base") {
      try {
        const networkAccount = await cdpAccount.useNetwork(this.cfg.network);
        const maybeFaucet = (networkAccount as { requestFaucet?: unknown }).requestFaucet;
        if (typeof maybeFaucet === "function") {
          await (maybeFaucet as (o: { token: "eth" | "usdc" }) => Promise<unknown>).call(
            networkAccount,
            { token: "eth" },
          );
        }
      } catch {
        // Best-effort.
      }
    }

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
      source: "cdp:eoa",
    };
  }

  private async bootstrapSmart(opts: BootstrapOptions): Promise<BootstrappedWallet> {
    const network: CdpKnownNetwork = this.cfg.network ?? "base-sepolia";

    // Owner EOA — held by CDP, signs UserOps + 1271 attestations on behalf of
    // the smart wallet. Idempotent by name + suffix so the same boot resolves
    // the same owner.
    const owner = await this.cdp.evm.getOrCreateAccount({
      name: `${this.cfg.accountName}-owner`,
    });

    const smart = await this.cdp.evm.getOrCreateSmartAccount({
      name: this.cfg.accountName,
      owner,
    });

    // Network-scope: signTypedData lives on the scoped variant for smart
    // accounts (it's where the network-aware EIP-712 domain wiring sits).
    const scoped = await smart.useNetwork(network);

    if (this.cfg.faucet) {
      try {
        const maybeFaucet = (scoped as { requestFaucet?: unknown }).requestFaucet;
        if (typeof maybeFaucet === "function") {
          await (maybeFaucet as (o: { token: "eth" }) => Promise<unknown>).call(scoped, {
            token: "eth",
          });
        }
      } catch {
        // Best-effort.
      }
    }

    // Wrap as viem Account. The smart account's signTypedData takes a
    // {domain, types, primaryType, message} options bag — same fields as
    // viem's TypedDataDefinition, just a flat call shape — so we forward.
    // signMessage / signTransaction aren't meaningful for a smart wallet
    // (txs go through UserOps), so we throw if anything calls them — the
    // x502 verifier only needs signTypedData.
    const account = toAccount({
      address: smart.address,
      async signMessage() {
        throw new Error(
          "CdpWalletProvider(smart): signMessage is not supported; use UserOps for wallet ops",
        );
      },
      async signTransaction() {
        throw new Error("CdpWalletProvider(smart): signTransaction is not supported; use UserOps");
      },
      async signTypedData<
        const td extends TypedData | Record<string, unknown>,
        primary extends keyof td | "EIP712Domain" = keyof td,
      >(parameters: TypedDataDefinition<td, primary>): Promise<Hex> {
        return scoped.signTypedData({
          domain: parameters.domain,
          types: parameters.types,
          primaryType: parameters.primaryType,
          message: parameters.message,
        } as Parameters<typeof scoped.signTypedData>[0]);
      },
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
      address: smart.address,
      source: "cdp:smart",
    };
  }
}
