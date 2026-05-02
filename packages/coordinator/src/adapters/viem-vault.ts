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
  }): Promise<Hex> {
    // simulate first so revert reasons surface cleanly. The ABI cast is
    // necessary because the checked-in `bountyVaultAbi` lags the contract
    // until `forge build && extract-abis` runs in CI (the on-chain shape
    // is bytes32[] attestationUIDs).
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
      ] as never,
      account: this.account,
    });
    const txHash = await this.wallet.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }
}
