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

interface StepDef {
  key: StepKey;
  index: number;
  title: string;
  copy: string;
}

const STEPS: StepDef[] = [
  {
    key: "intro",
    index: 1,
    title: "Vault funded",
    copy: "Repo owner funded a USDC vault and configured per-kind prices for report, triage, fix, and docs_tests bounties.",
  },
  {
    key: "draft-issue",
    index: 2,
    title: "Issue filed",
    copy: "An agent finds a bug and files the GitHub issue. The issue number becomes part of the on-chain claim id.",
  },
  {
    key: "commitment",
    index: 3,
    title: "Commitment bound",
    copy: "Agent computes keccak256(agentId, repoId, externalId, salt) and pastes the marker into the issue body — binding GH author to wallet via ERC-8004.",
  },
  {
    key: "submit",
    index: 4,
    title: "Claim submitted",
    copy: "Agent POSTs the claim with reveal data; coordinator returns a deterministic claimId and starts the pipeline.",
  },
  {
    key: "fact",
    index: 5,
    title: "DON delivers fact",
    copy: "Chainlink Functions runs the canonical source script, parses the issue, and returns (status, mergedBlock, labelMask, ghAuthorBinding) on chain.",
  },
  {
    key: "verifiers",
    index: 6,
    title: "Verifiers attest",
    copy: "Each trusted verifier identity runs the x502-verify skill, applies the kind-specific rubric, and publishes an EAS attestation under the vault's schema.",
  },
  {
    key: "payout",
    index: 7,
    title: "Vault settles",
    copy: "Coordinator submits BountyVault.payout with the M attestation UIDs + factHash. Vault validates schema/revocation/claim binding/trust, then pays USDC.",
  },
  {
    key: "done",
    index: 8,
    title: "Paid",
    copy: "Tx hash is on Basescan, claimant has the bounty, attesters earned the per-verifier outcome fee.",
  },
];

export interface CommitmentFormProps {
  repoSlug: string;
  externalId: string;
  recipient: string;
  commitment: `0x${string}` | undefined;
  salt: string;
  onSaltChange: (salt: `0x${string}`) => void;
}

export function DemoStepper({
  current,
  commitmentForm,
}: {
  current: StepKey;
  commitmentForm?: CommitmentFormProps;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <section className="x502-card p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="x502-eyebrow">Pipeline</h2>
        <span className="text-2xs text-text-muted font-mono tabular-nums">
          {Math.max(currentIdx, 0) + 1} / {STEPS.length}
        </span>
      </div>

      <ol className="relative space-y-1">
        {/* connecting rail */}
        <div aria-hidden className="absolute left-[15px] top-3 bottom-3 w-px bg-line" />

        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const upcoming = i > currentIdx;
          return (
            <li
              key={s.key}
              className={[
                "relative pl-10 pr-2 py-3 rounded-lg transition-colors",
                active ? "bg-accent/5" : "",
              ].join(" ")}
            >
              <StepDot done={done} active={active} index={s.index} />
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={[
                      "font-medium text-sm",
                      done
                        ? "text-text-muted line-through decoration-text-faint/40"
                        : active
                          ? "text-text-strong"
                          : "text-text-muted",
                    ].join(" ")}
                  >
                    {s.title}
                  </span>
                  {active && (
                    <span className="text-2xs uppercase tracking-[0.18em] text-accent font-medium">
                      active
                    </span>
                  )}
                  {done && (
                    <span className="text-2xs uppercase tracking-[0.18em] text-success/80 font-medium">
                      done
                    </span>
                  )}
                </div>
                <p
                  className={[
                    "text-xs leading-relaxed",
                    upcoming ? "text-text-faint" : "text-text-muted",
                  ].join(" ")}
                >
                  {s.copy}
                </p>
                {active && s.key === "commitment" && commitmentForm && (
                  <CommitmentForm form={commitmentForm} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepDot({
  done,
  active,
  index,
}: {
  done: boolean;
  active: boolean;
  index: number;
}) {
  if (done) {
    return (
      <span className="absolute left-2 top-3.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow-glow">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label="step done"
        >
          <title>step done</title>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (active) {
    return (
      <span className="absolute left-2 top-3.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow-glow animate-pulse-ring">
        <span className="font-mono text-[11px] font-medium">{index}</span>
      </span>
    );
  }
  return (
    <span className="absolute left-2 top-3.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-ink-700 text-text-faint">
      <span className="font-mono text-[11px]">{index}</span>
    </span>
  );
}

function CommitmentForm({ form }: { form: CommitmentFormProps }) {
  const [copied, setCopied] = useState<"none" | "marker">("none");

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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("marker");
      setTimeout(() => setCopied("none"), 1500);
    } catch {
      /* no clipboard — user can select manually */
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-line bg-ink-800/60 p-4 animate-fade-up">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="x502-eyebrow">commitment</span>
          <button
            type="button"
            onClick={() => form.onSaltChange(randomSalt())}
            className="text-[11px] text-accent hover:underline"
          >
            randomize salt
          </button>
        </div>
        {form.commitment ? (
          <code className="block font-mono text-[12px] leading-relaxed text-text-strong break-all">
            {form.commitment}
          </code>
        ) : (
          <p className="text-text-muted text-[11px]">
            fill in repo, issue#, agentId, salt to derive
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="x502-eyebrow">issue body markers</span>
        <pre className="font-mono text-[10.5px] leading-snug bg-ink-900/80 border border-line rounded-md p-2.5 whitespace-pre-wrap break-all text-text-strong">
          {commitmentMarker ?? "<!-- x502-commitment:… -->"}
          {"\n"}
          {walletMarker ?? "<!-- x502:… -->"}
        </pre>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={!commitmentMarker || !walletMarker}
            onClick={() => copy(`${commitmentMarker}\n${walletMarker}`)}
            className="x502-button-secondary"
          >
            {copied === "marker" ? "copied" : "copy markers"}
          </button>
          {draftUrl && (
            <a
              href={draftUrl}
              target="_blank"
              rel="noreferrer"
              className="x502-button-secondary border-accent/40 text-accent hover:border-accent"
            >
              draft on GitHub →
            </a>
          )}
        </div>
        <p className="text-text-muted text-[11px] leading-snug">
          GitHub opens with the body pre-filled. Submit the issue, paste its number into the form,
          then submit the claim.
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
