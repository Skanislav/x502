import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { bountyVaultAbi } from "@x502/shared/abis";
import type { Kind, SignedAttestation } from "@x502/shared";

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
    attestations: SignedAttestation[];
  }): Promise<Hex> {
    const agentIds = args.attestations.map((a) => a.agentId);
    const signatures = args.attestations.map((a) => a.signature);

    // viem: simulate first to surface revert reason cleanly.
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
        agentIds,
        signatures,
      ],
      account: this.account,
    });
    const txHash = await this.wallet.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }
}
