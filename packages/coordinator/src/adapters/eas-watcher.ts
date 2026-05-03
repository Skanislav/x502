import type { EventSubscriber } from "@x502/shared";
import { mockEASAbi } from "@x502/shared/abis";
import { type Address, type Hex, type PublicClient, decodeAbiParameters } from "viem";

import type { AttestationInbox } from "../inbox.js";
import type { ClaimState } from "../types.js";

interface EasWatcherOptions {
  backfillBlocks?: bigint;
}

interface EasAttestedLog {
  args: {
    uid?: Hex;
    attester?: Address;
  };
}

/// Watches the EAS contract for `Attested(...)` events under the vault's
/// schema and forwards them into the AttestationInbox. The coordinator's
/// pipeline awaits the inbox; once threshold attestations land for a
/// claim, the awaiting promise resolves and the pipeline submits the
/// vault.payout call.
///
/// Events come from any IEAS-compatible contract — MockEAS in local mode
/// or the real EAS predeploy at 0x4200…0021 on Base / Base Sepolia.
export class EasAttestationWatcher {
  private unwatch?: () => void;

  constructor(
    private readonly publicClient: PublicClient,
    private readonly easAddress: Address,
    private readonly schemaUID: Hex,
    private readonly inbox: AttestationInbox,
    /// Resolves a claimId to the active ClaimState for this coordinator.
    /// Returns undefined when we don't recognize the claim (stale,
    /// different coordinator, etc.) — those events are silently dropped.
    private readonly claimResolver: (claimId: Hex) => ClaimState | undefined,
    /// Optional event bus — published `attestation.observed` events drive
    /// the web verifier theater so the UI surfaces UIDs as they land.
    private readonly events?: EventSubscriber,
    private readonly logger?: { warn: (msg: string) => void },
    private readonly options: EasWatcherOptions = {},
  ) {}

  start(): void {
    if (this.unwatch) return;
    this.unwatch = this.publicClient.watchContractEvent({
      address: this.easAddress,
      abi: mockEASAbi,
      eventName: "Attested",
      args: { schema: this.schemaUID },
      onLogs: (logs) => {
        this.handleLogs(logs as EasAttestedLog[]);
      },
    });
    void this.backfillRecentLogs();
  }

  stop(): void {
    this.unwatch?.();
    this.unwatch = undefined;
  }

  private async backfillRecentLogs(): Promise<void> {
    const backfillBlocks = this.options.backfillBlocks ?? 500n;
    if (backfillBlocks <= 0n) return;

    try {
      const head = await this.publicClient.getBlockNumber();
      const fromBlock = head > backfillBlocks ? head - backfillBlocks : 0n;
      const logs = await this.publicClient.getContractEvents({
        address: this.easAddress,
        abi: mockEASAbi,
        eventName: "Attested",
        args: { schema: this.schemaUID },
        fromBlock,
        toBlock: head,
      });
      this.handleLogs(logs as EasAttestedLog[]);
    } catch (e) {
      this.logger?.warn(`eas-watcher backfill failed: ${(e as Error).message}`);
    }
  }

  private handleLogs(logs: EasAttestedLog[]): void {
    for (const log of logs) {
      this.handleLog(log).catch((e) => {
        this.logger?.warn(`eas-watcher handleLog failed: ${(e as Error).message}`);
      });
    }
  }

  private async handleLog(log: EasAttestedLog): Promise<void> {
    const uid = log.args.uid;
    const attester = log.args.attester;
    if (!uid || !attester) return;

    // Pull the full attestation so we can decode (claimId, factHash, accept).
    const att = (await this.publicClient.readContract({
      address: this.easAddress,
      abi: mockEASAbi,
      functionName: "getAttestation",
      args: [uid],
    })) as {
      uid: Hex;
      schema: Hex;
      revocationTime: bigint;
      attester: Address;
      data: Hex;
    };
    if (att.schema.toLowerCase() !== this.schemaUID.toLowerCase()) return;
    if (att.revocationTime !== 0n) return;

    let claimId: Hex;
    let factHash: Hex;
    let accept: boolean;
    try {
      [claimId, factHash, accept] = decodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "bool" }],
        att.data,
      ) as [Hex, Hex, boolean];
    } catch {
      // Malformed data — silently drop. Vault would reject too.
      return;
    }
    if (!accept) return;

    const state = this.claimResolver(claimId);
    if (!state || !state.factHash) return;
    // The attester signed `(claimId, factHash, accept)`. If their factHash
    // doesn't match the fact this coordinator is tracking for the claim,
    // their attestation will be rejected on-chain by the vault — pushing
    // it into the inbox would just let it count toward threshold and then
    // revert payout. Drop and warn instead.
    if (factHash.toLowerCase() !== state.factHash.toLowerCase()) {
      this.logger?.warn(
        `eas-watcher: attestation ${uid} factHash ${factHash} != state.factHash ${state.factHash}; dropping`,
      );
      return;
    }

    const result = this.inbox.push({
      claimId,
      factHash,
      uid,
      attester: att.attester,
    });
    if (result.accepted) {
      this.events?.publish({
        type: "attestation.observed",
        claimId,
        uid,
        attester: att.attester,
        ts: Date.now(),
      });
    }
  }
}
