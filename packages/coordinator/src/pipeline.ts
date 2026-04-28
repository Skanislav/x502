import type { Kind, SignedAttestation } from "@x502/shared";
import { type Hex, keccak256 } from "viem";

import type { IFactProvider, IVaultWriter, IVerifierClient } from "./providers.js";
import type { ClaimState } from "./types.js";

export interface PipelineDeps {
  factProvider: IFactProvider;
  verifiers: IVerifierClient[];
  vault: IVaultWriter;
  threshold: number;
  factTimeoutMs: number;
  verifierTimeoutMs: number;
}

/// Drives a single claim from `verifying` → `paid` (or `failed`). Resolves when
/// the terminal state has been reached. Mutates `state` in place; HTTP poll
/// handler reads `state` to compute its response.
export async function runClaimPipeline(state: ClaimState, deps: PipelineDeps): Promise<void> {
  const { repoId, request, deadline, claimId } = state;

  // 1) Trigger Chainlink Functions fact request and verifier fan-out in parallel.
  const factPromise = (async () => {
    await deps.factProvider.requestFact(
      claimId,
      request.repoSlug,
      request.externalId,
      request.kind,
    );
    return deps.factProvider.awaitFact(claimId, deps.factTimeoutMs);
  })();

  const factBlob = await factPromise;
  state.factBlob = factBlob;
  state.factHash = keccak256(factBlob);

  // 2) Now we know factHash, ask each verifier to sign over it.
  //    (We could fan-out earlier with a guess, but the signed factHash binds
  //    the agent to the exact onchain fact — no race.)
  const verifyPromises = deps.verifiers.map(async (v) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const r = await Promise.race([
        v.verify({
          repoId,
          externalId: request.externalId,
          kind: request.kind,
          recipient: request.recipient,
          deadline,
          factHash: state.factHash!,
          agentIdReveal: request.agentIdReveal,
          saltReveal: request.saltReveal,
        }),
        new Promise<{ rejected: string }>((_, rej) => {
          timeout = setTimeout(() => rej(new Error("verifier timeout")), deps.verifierTimeoutMs);
        }),
      ]);
      return r;
    } catch (e) {
      return { rejected: (e as Error).message };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  });

  const responses = await Promise.all(verifyPromises);
  const accepted: SignedAttestation[] = [];
  const rejections: string[] = [];
  for (const r of responses) {
    if ("rejected" in r) rejections.push(r.rejected);
    else accepted.push(r);
  }

  if (accepted.length < deps.threshold) {
    state.status = "failed";
    state.error = `insufficient verifier signatures: ${accepted.length}/${deps.threshold} (${rejections.join("; ")})`;
    state.updatedAt = Date.now();
    return;
  }

  // 3) Trim to threshold (deterministic: sort by agentId for reproducibility)
  accepted.sort((a, b) => (a.agentId < b.agentId ? -1 : 1));
  state.attestations = accepted.slice(0, deps.threshold);
  state.status = "ready";
  state.updatedAt = Date.now();

  // 4) Submit payout
  try {
    const tx = await deps.vault.submitPayout({
      repoId,
      externalId: request.externalId,
      kind: request.kind,
      recipient: request.recipient,
      deadline,
      factHash: state.factHash!,
      attestations: state.attestations,
    });
    state.txHash = tx;
    state.status = "paid";
    state.updatedAt = Date.now();
  } catch (e) {
    state.status = "failed";
    state.error = `vault.payout reverted: ${(e as Error).message}`;
    state.updatedAt = Date.now();
  }
}
