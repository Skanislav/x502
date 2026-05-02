import { type Account, type Address, type Hex, type WalletClient, encodeAbiParameters } from "viem";

import { attestationTypedData } from "./eip712.js";
import type { Attestation } from "./types.js";

/// Wrap config for verifiers whose registered identity is an ERC-1271 smart
/// account that may not be deployed yet. After producing the inner ECDSA
/// signature, signAttestation appends the EIP-6492 magic suffix and the
/// embedded factory call so the vault's `ERC6492SignatureChecker` can deploy
/// the wallet during the first payout — first claim "just works" without a
/// pre-deploy step.
export interface SmartWalletWrap {
  /// The smart-wallet's on-chain address (registered in IdentityRegistry).
  address: Address;
  /// Address of the factory that the vault calls to deploy the wallet.
  factory: Address;
  /// Calldata the vault should pass to `factory` (e.g. encoded
  /// `factory.deploy(owner, salt)`). Must deploy code at `address`.
  factoryCalldata: Hex;
}

export interface SignerConfig {
  agentId: bigint;
  vault: Address;
  chainId: number;
  account: Account;
  wallet: WalletClient;
  /// When set, signatures are wrapped per ERC-6492 so the vault can verify
  /// against `smartWallet.address` even before that wallet has been deployed.
  smartWallet?: SmartWalletWrap;
}

/// EIP-6492 magic suffix — same constant the on-chain checker compares to.
export const ERC6492_MAGIC =
  "0x6492649264926492649264926492649264926492649264926492649264926492" as const;

export async function signAttestation(
  cfg: SignerConfig,
  att: Attestation,
): Promise<{ agentId: bigint; signature: Hex; attestation: Attestation }> {
  const td = attestationTypedData(cfg.chainId, cfg.vault, att);
  const innerSig = await cfg.wallet.signTypedData({
    account: cfg.account,
    domain: td.domain,
    types: td.types,
    primaryType: td.primaryType,
    message: td.message,
  });

  const signature = cfg.smartWallet ? wrap6492(innerSig, cfg.smartWallet) : innerSig;
  return { agentId: cfg.agentId, signature, attestation: att };
}

/// `abi.encode(factory, factoryCalldata, innerSig) || ERC6492_MAGIC`
export function wrap6492(innerSig: Hex, w: SmartWalletWrap): Hex {
  const encoded = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }, { type: "bytes" }],
    [w.factory, w.factoryCalldata, innerSig],
  );
  return `${encoded}${ERC6492_MAGIC.slice(2)}` as Hex;
}

/// Effective on-chain identity for this signer. When wrapped in a smart
/// account, that's the wallet's address; otherwise the EOA's address.
export function signerAddress(cfg: SignerConfig): Address {
  return cfg.smartWallet?.address ?? (cfg.account.address as Address);
}
