import type { Kind } from "@x502/shared";
import { bountyVaultAbi } from "@x502/shared/abis";
import type { Account, Address, Hex, PublicClient, WalletClient } from "viem";

import type { IVaultWriter } from "../providers.js";

export class ViemVaultWriter implements IVaultWriter {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly wallet: WalletClient,
    private readonly account: Account,
    private readonly vault: Address,
  ) {}

  async submitPayout(args: {
    repoId: Hex;
    externalId: bigint;
    kind: Kind;
    recipient: Address;
    deadline: bigint;
    factHash: Hex;
    attestationUIDs: Hex[];
    onSubmitted?: (txHash: Hex) => void;
  }): Promise<Hex> {
    // simulate first so revert reasons surface cleanly.
    const { request } = await this.publicClient.simulateContract({
      address: this.vault,
      abi: bountyVaultAbi,
      functionName: "payout",
      args: [
        args.repoId,
        args.externalId,
        args.kind,
        args.recipient,
        args.deadline,
        args.factHash,
        args.attestationUIDs,
      ],
      account: this.account,
    });
    const txHash = await this.wallet.writeContract(request);
    args.onSubmitted?.(txHash);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`payout tx ${txHash} reverted on-chain`);
    }
    return txHash;
  }
}
