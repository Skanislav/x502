import type { EventSubscriber } from "@x502/shared";
import { type Hex, decodeAbiParameters, keccak256 } from "viem";

import type { AttestationInbox } from "./inbox.js";
import type { IFactProvider, IVaultWriter } from "./providers.js";
import type { ClaimState } from "./types.js";

export interface PipelineDeps {
  factProvider: IFactProvider;
  vault: IVaultWriter;
  /// Per-claim collector for EAS attestation UIDs. The EAS event watcher
  /// observes `Attested` events under the vault's schema and pushes
  /// matching ones here. Pipeline awaits the inbox until threshold UIDs
  /// have arrived (or it times out).
  inbox: AttestationInbox;
  threshold: number;
  /// Lower-cased addresses of trusted attesters for this claim's repo —
  /// resolved at /claim time from `repo.trustedAgentIds` via the agent
  /// registry. Inbox-pushes from any other attester are silently dropped.
  trustedAttesters: Set<string>;
  factTimeoutMs: number;
  /// How long the coordinator waits for verifiers to attest via EAS after
  /// the fact has been delivered. Verifiers are humans driving `claude`
  /// locally, so this is generous (default 5 min).
  attestationTimeoutMs: number;
  events?: EventSubscriber;
}

/// Drives a single claim from `verifying` → `paid` (or `failed`). Resolves
/// when the terminal state has been reached. Mutates `state` in place; HTTP
/// poll handler reads `state` to compute its response.
export async function runClaimPipeline(state: ClaimState, deps: PipelineDeps): Promise<void> {
  const { repoId, request, deadline, claimId } = state;

  // 1) Trigger the Chainlink Functions fact request.
  deps.events?.publish({ type: "fact.requested", claimId, ts: Date.now() });
  await deps.factProvider.requestFact(claimId, request.repoSlug, request.externalId, request.kind);
  const factBlob = await deps.factProvider.awaitFact(claimId, deps.factTimeoutMs);
  state.factBlob = factBlob;
  state.factHash = keccak256(factBlob);
  if (deps.events) {
    try {
      const [status, mergedBlock, labelMask, ghAuthorBinding] = decodeAbiParameters(
        [{ type: "uint8" }, { type: "uint64" }, { type: "bytes32" }, { type: "address" }],
        factBlob,
      );
      deps.events.publish({
        type: "fact.delivered",
        claimId,
        status: Number(status),
        mergedBlock: mergedBlock.toString(),
        labelMask: labelMask as Hex,
        ghAuthorBinding: ghAuthorBinding as `0x${string}`,
        ts: Date.now(),
      });
    } catch {
      /* unexpected blob shape — skip emit, the vault will still validate. */
    }
  }

  // 2) Open the inbox for this claim and wait for verifier-side skill
  //    helpers (humans running `claude` with the x502-verify skill on their
  //    own machines) to publish attestations to EAS. The coordinator's
  //    EAS event watcher observes the on-chain Attested events and pushes
  //    matching ones here.
  let attestationUIDs: Hex[];
  try {
    attestationUIDs = await deps.inbox.await({
      claimId,
      factHash: state.factHash!,
      threshold: deps.threshold,
      trustedAttesters: deps.trustedAttesters,
      timeoutMs: deps.attestationTimeoutMs,
    });
  } catch (e) {
    state.status = "failed";
    state.error = (e as Error).message;
    state.updatedAt = Date.now();
    return;
  }

  state.attestationUIDs = attestationUIDs;
  state.status = "ready";
  state.updatedAt = Date.now();

  // 3) Submit payout (permissionless on-chain — coordinator does it as a
  //    convenience but anyone with the UIDs could). The writer fires
  //    `onSubmitted` once the tx hash is known and resolves only after a
  //    successful receipt, so `payout.confirmed` only emits when the tx
  //    actually mined with status=success.
  try {
    const tx = await deps.vault.submitPayout({
      repoId,
      externalId: request.externalId,
      kind: request.kind,
      recipient: request.recipient,
      deadline,
      factHash: state.factHash!,
      attestationUIDs,
      onSubmitted: (txHash) => {
        state.txHash = txHash;
        deps.events?.publish({ type: "payout.submitted", claimId, txHash, ts: Date.now() });
      },
    });
    state.txHash = tx;
    state.status = "paid";
    state.updatedAt = Date.now();
    deps.events?.publish({ type: "payout.confirmed", claimId, txHash: tx, ts: Date.now() });
  } catch (e) {
    state.status = "failed";
    state.error = `vault.payout reverted: ${(e as Error).message}`;
    state.updatedAt = Date.now();
  }
}
