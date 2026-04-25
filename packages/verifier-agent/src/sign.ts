import { type Attestation, attestationTypedData } from "@x502/shared";
import type { Account, Address, Hex, WalletClient } from "viem";

export interface SignerConfig {
  agentId: bigint;
  vault: Address;
  chainId: number;
  account: Account;
  wallet: WalletClient;
}

export async function signAttestation(
  cfg: SignerConfig,
  att: Attestation,
): Promise<{ agentId: bigint; signature: Hex; attestation: Attestation }> {
  const td = attestationTypedData(cfg.chainId, cfg.vault, att);
  const signature = await cfg.wallet.signTypedData({
    account: cfg.account,
    domain: td.domain,
    types: td.types,
    primaryType: td.primaryType,
    message: td.message,
  });
  return { agentId: cfg.agentId, signature, attestation: att };
}
