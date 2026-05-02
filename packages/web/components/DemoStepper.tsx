"use client";

import { useState } from "react";

export type StepKey =
  | "intro"
  | "draft-issue"
  | "commitment"
  | "submit"
  | "fact"
  | "verifiers"
  | "payout"
  | "done";

const STEPS: Array<{ key: StepKey; title: string; copy: string }> = [
  {
    key: "intro",
    title: "1 · The setup",
    copy: "A repo owner has funded a vault with USDC. Bounties pay out for verifiable GitHub outcomes (report, triage, fix, docs_tests).",
  },
  {
    key: "draft-issue",
    title: "2 · File the issue",
    copy: "An agent (Alice) finds a bug. She files the GitHub issue. The issue number `#N` becomes part of her commitment.",
  },
  {
    key: "commitment",
    title: "3 · Bind the commitment",
    copy: "Alice computes `keccak256(agentId, repoId, externalId, salt)` and pastes it into the issue body. This binds the GH author to her wallet via ERC-8004.",
  },
  {
    key: "submit",
    title: "4 · Submit the claim",
    copy: "Alice POSTs the claim to the coordinator with her commitment reveal. The coordinator returns a claimId and starts the pipeline.",
  },
  {
    key: "fact",
    title: "5 · DON delivers the fact",
    copy: "Chainlink Functions (locally simulated) fetches the issue, applies the kind-specific rules from `chainlink/source-core.js`, and returns `(status, mergedBlock, labelMask, ghAuthorBinding)` on chain.",
  },
  {
    key: "verifiers",
    title: "6 · Verifiers attest",
    copy: "Each verifier identity runs the `x502-verify` skill in their local Claude. The skill fetches the issue, applies the kind-specific rubric, and publishes an EAS attestation under the vault's schema for `(claimId, factHash, accept)`. The coordinator's EAS event watcher observes them on-chain until M of N have landed.",
  },
  {
    key: "payout",
    title: "7 · Vault settles",
    copy: "Coordinator submits `BountyVault.payout(...)` with the M attestation UIDs + factHash. The vault re-fetches each attestation by UID, validates schema/revocation/claim binding/trust, and transfers USDC to Alice + a tiny outcome fee to each attester.",
  },
  {
    key: "done",
    title: "8 · Paid",
    copy: "Tx hash visible on Basescan (or local anvil). Alice has the bounty in her wallet, the protocol has a verifiable trail.",
  },
];

export interface CommitmentFormProps {
  repoSlug: string;
  externalId: string;
  recipient: string;
  /// Already-derived commitment hash; pass `undefined` when inputs are
  /// incomplete (the form shows a hint instead of a stale value).
  commitment: `0x${string}` | undefined;
  salt: string;
  onSaltChange: (salt: `0x${string}`) => void;
}

export function DemoStepper({
  current,
  commitmentForm,
}: {
  current: StepKey;
  /// When provided AND the active step is `commitment`, the stepper renders
  /// inline copy/draft helpers so the user never has to manually shuffle
  /// markers between this app and GitHub.
  commitmentForm?: CommitmentFormProps;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted">Demo walkthrough</h2>
      <ol className="space-y-2">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li
              key={s.key}
              className={[
                "rounded border p-3 transition",
                active
                  ? "border-accent/60 bg-accent/5"
                  : done
                    ? "border-paper/10 opacity-60"
                    : "border-paper/10 opacity-40",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{s.title}</span>
                {done && <span className="text-xs text-accent">done</span>}
                {active && <span className="text-xs text-accent animate-pulse">active</span>}
              </div>
              <p className="text-xs text-muted leading-5 mt-1">{s.copy}</p>
              {active && s.key === "commitment" && commitmentForm && (
                <CommitmentForm form={commitmentForm} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CommitmentForm({ form }: { form: CommitmentFormProps }) {
  const [copied, setCopied] = useState<"none" | "marker" | "wallet">("none");

  const commitmentMarker = form.commitment
    ? `<!-- x502-commitment:${form.commitment} -->`
    : undefined;
  const walletMarker = form.recipient ? `<!-- x502:${form.recipient} -->` : undefined;
  const issueBody = [
    "<!-- describe the bug, repro steps, expected vs actual -->",
    "",
    commitmentMarker ?? "<!-- x502-commitment:0x... (paste from x502 demo UI) -->",
    walletMarker ?? "<!-- x502:0xRECIPIENT (paste from x502 demo UI) -->",
  ].join("\n");
  const draftUrl = form.repoSlug.includes("/")
    ? `https://github.com/${form.repoSlug}/issues/new?title=${encodeURIComponent("[x502] bug: ")}&body=${encodeURIComponent(issueBody)}`
    : undefined;

  const copy = async (text: string, kind: "marker" | "wallet") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied("none"), 1500);
    } catch {
      /* clipboard API unavailable — user can select manually */
    }
  };

  return (
    <div className="pt-3 space-y-3 text-xs">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">commitment hash</span>
          <button
            type="button"
            onClick={() => form.onSaltChange(randomSalt())}
            className="text-[11px] text-accent hover:underline"
          >
            randomize salt
          </button>
        </div>
        {form.commitment ? (
          <code className="block font-mono text-[11px] break-all bg-paper/5 rounded p-2">
            {form.commitment}
          </code>
        ) : (
          <p className="text-muted text-[11px]">fill in repo, issue#, agentId, salt to derive</p>
        )}
      </div>

      <div className="space-y-1">
        <span className="text-muted">paste these two lines into the issue body</span>
        <pre className="font-mono text-[10px] break-all bg-paper/5 rounded p-2 whitespace-pre-wrap leading-snug">
          {commitmentMarker ?? "<!-- x502-commitment:… -->"}
          {"\n"}
          {walletMarker ?? "<!-- x502:… -->"}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!commitmentMarker || !walletMarker}
            onClick={() => copy(`${commitmentMarker}\n${walletMarker}`, "marker")}
            className="px-2 py-1 rounded border border-paper/20 hover:border-accent disabled:opacity-30"
          >
            {copied === "marker" ? "copied!" : "copy markers"}
          </button>
          {draftUrl && (
            <a
              href={draftUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 rounded border border-accent/40 text-accent hover:bg-accent/10"
            >
              draft issue on GitHub →
            </a>
          )}
        </div>
        <p className="text-muted text-[10px]">
          GitHub will open with the body pre-filled. Submit the issue, copy its number back into the
          form, then click "Submit claim".
        </p>
      </div>
    </div>
  );
}

function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s as `0x${string}`;
}

/// Maps the existing PipelineState onto the stepper's enum. Idle pipelines
/// resolve to `commitment` because that's where the user is actually doing
/// work pre-submission — the inline CommitmentForm lives in that step.
export function stepFromPipeline(pipeline: {
  status: string;
  factReady?: boolean;
  sigs?: number;
}): StepKey {
  if (pipeline.status === "paid") return "done";
  if (pipeline.status === "failed") return "payout";
  if (pipeline.status === "ready") return "payout";
  if ((pipeline.sigs ?? 0) > 0) return "verifiers";
  if (pipeline.factReady) return "verifiers";
  if (pipeline.status === "verifying") return "submit";
  return "commitment";
}
