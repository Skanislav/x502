import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { mockGitHubFactProviderAbi } from "@x502/shared/abis";
import type { Kind } from "@x502/shared";

import type { IFactProvider } from "../providers.js";

interface PendingFact {
  resolve: (blob: Hex) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/// Watches `FactFulfilled` events on any IGitHubFactProvider impl
/// (MockGitHubFactProvider or the real Chainlink Functions consumer).
export class ViemFactProvider implements IFactProvider {
  private readonly pending = new Map<Hex, PendingFact>();
  private unwatch?: () => void;

  constructor(
    private readonly publicClient: PublicClient,
    private readonly wallet: WalletClient,
    private readonly account: Account,
    private readonly providerAddress: Address,
  ) {}

  start(): void {
    if (this.unwatch) return;
    this.unwatch = this.publicClient.watchContractEvent({
      address: this.providerAddress,
      abi: mockGitHubFactProviderAbi,
      eventName: "FactFulfilled",
      onLogs: (logs) => {
        for (const l of logs) {
          const cid = l.args.claimId as Hex | undefined;
          const blob = l.args.factBlob as Hex | undefined;
          if (!cid || blob === undefined) continue;
          const p = this.pending.get(cid);
          if (!p) continue;
          clearTimeout(p.timer);
          this.pending.delete(cid);
          p.resolve(blob);
        }
      },
    });
  }

  stop(): void {
    this.unwatch?.();
    this.unwatch = undefined;
  }

  async requestFact(claimId: Hex, repoSlug: string, externalId: bigint, kind: Kind): Promise<void> {
    this.start();
    const { request } = await this.publicClient.simulateContract({
      address: this.providerAddress,
      abi: mockGitHubFactProviderAbi,
      functionName: "requestFact",
      args: [claimId, repoSlug, externalId, kind],
      account: this.account,
    });
    const tx = await this.wallet.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash: tx });
  }

  async awaitFact(claimId: Hex, timeoutMs: number): Promise<Hex> {
    // Fast path: already delivered (e.g. in tests where mockFulfill ran first).
    const [ready, blob] = (await this.publicClient.readContract({
      address: this.providerAddress,
      abi: mockGitHubFactProviderAbi,
      functionName: "getFact",
      args: [claimId],
    })) as [boolean, Hex];
    if (ready) return blob;

    return new Promise<Hex>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(claimId);
        reject(new Error(`fact not delivered within ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(claimId, { resolve, reject, timer });
    });
  }
}
