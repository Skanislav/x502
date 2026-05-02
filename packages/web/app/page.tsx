"use client";

import { DemoStepper, type StepKey, stepFromPipeline } from "@/components/DemoStepper";
import { SepoliaReplay } from "@/components/SepoliaReplay";
import { VerifierTheater } from "@/components/VerifierTheater";
import { type PipelineState, mapPoll, previewCommitment } from "@/lib/claim-ui";
import { CoordinatorClient } from "@/lib/coordinator";
import { basescanTx, formatUsdc, shortHash } from "@/lib/format";
import type { KindName } from "@x502/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Address, type Hex, isAddress } from "viem";

const DEFAULT_COORDINATOR = process.env.NEXT_PUBLIC_COORDINATOR_URL ?? "http://localhost:8787";

interface DemoConfig {
  coordinator: { endpoint: string };
  verifiers: Array<{ agentId: string }>;
  repo: { slug: string };
}

const KIND_META: Record<KindName, { label: string; price: bigint; description: string }> = {
  report: {
    label: "report",
    price: 5_000_000n,
    description: "novel + reproducible bug report",
  },
  triage: {
    label: "triage",
    price: 2_000_000n,
    description: "added substantive labels + dedup links",
  },
  fix: {
    label: "fix",
    price: 50_000_000n,
    description: "merged PR closing a linked issue",
  },
  docs_tests: {
    label: "docs_tests",
    price: 30_000_000n,
    description: "merged PR adding tests or fixing stale docs",
  },
};

const OUTCOME_FEE_PER_VERIFIER = 100_000n;
const VERIFIER_COUNT = 2;

export default function Page() {
  const [coordinatorUrl, setCoordinatorUrl] = useState(DEFAULT_COORDINATOR);
  const [repoSlug, setRepoSlug] = useState("skanislav/x502");
  const [externalId, setExternalId] = useState("2");
  const [kind, setKind] = useState<KindName>("report");
  const [recipient, setRecipient] = useState<string>("");
  const [agentIdReveal, setAgentIdReveal] = useState("101");
  const [saltReveal, setSaltReveal] = useState(
    "0x000000000000000000000000000000000000000000000000000000000000beef",
  );

  const [pipeline, setPipeline] = useState<PipelineState>({ status: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Demo-mode state — populated by /api/demo-config when ?mode=demo is set.
  const [demoMode, setDemoMode] = useState(false);
  const [demoCfg, setDemoCfg] = useState<DemoConfig | undefined>();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("mode") !== "demo") return;
    setDemoMode(true);
    fetch("/api/demo-config")
      .then((r) => (r.ok ? (r.json() as Promise<DemoConfig>) : undefined))
      .then((cfg) => {
        if (!cfg) return;
        setDemoCfg(cfg);
        setCoordinatorUrl(cfg.coordinator.endpoint);
        setRepoSlug(cfg.repo.slug);
      })
      .catch(() => undefined);
  }, []);

  const meta = KIND_META[kind];
  const claimantAmount = meta.price - OUTCOME_FEE_PER_VERIFIER * BigInt(VERIFIER_COUNT);
  const stepperStep: StepKey = demoMode ? stepFromPipeline(pipeline) : "intro";

  const commitmentPreview = useMemo(
    () => previewCommitment({ repoSlug, externalId, agentIdReveal, saltReveal }),
    [repoSlug, externalId, agentIdReveal, saltReveal],
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function submit() {
    setPipeline({ status: "idle" });
    if (!isAddress(recipient)) {
      setPipeline({ status: "failed", error: "recipient must be a 0x-address" });
      return;
    }
    const client = new CoordinatorClient(coordinatorUrl);
    try {
      const r = await client.postClaim({
        repoSlug,
        externalId,
        kind,
        recipient: recipient as Address,
        agentIdReveal,
        saltReveal: saltReveal as Hex,
      });
      setPipeline({ claimId: r.claimId, status: "verifying" });
      startPolling(client, r.claimId);
    } catch (e) {
      setPipeline({ status: "failed", error: (e as Error).message });
    }
  }

  function startPolling(client: CoordinatorClient, claimId: Hex) {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const { status, body } = await client.poll(claimId);
        setPipeline(mapPoll(claimId, body));
        if (status === 200 || status === 410 || attempts > 60) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (e) {
        console.warn("poll error", e);
      }
    }, 1500);
  }

  const claimForm = (
    <>
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted">Coordinator</h2>
        <input
          type="text"
          value={coordinatorUrl}
          onChange={(e) => setCoordinatorUrl(e.target.value)}
          className="w-full bg-paper/5 border border-paper/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="http://localhost:8787"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted">File a claim</h2>

        <Field label="Repo (owner/name)">
          <input value={repoSlug} onChange={(e) => setRepoSlug(e.target.value)} className="input" />
        </Field>

        <Field label="Issue or PR number">
          <input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            inputMode="numeric"
            className="input"
          />
        </Field>

        <Field label="Bounty kind">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(KIND_META) as KindName[]).map((k) => {
              const m = KIND_META[k];
              const selected = k === kind;
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  className={[
                    "text-left rounded border px-3 py-2 transition",
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-paper/10 hover:border-paper/30",
                  ].join(" ")}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{m.label}</span>
                    <span className="text-xs text-muted">{formatUsdc(m.price)}</span>
                  </div>
                  <div className="text-xs text-muted leading-5">{m.description}</div>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Recipient (your wallet)">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x…"
            className="input"
          />
        </Field>

        <details className="text-sm" open={demoMode}>
          <summary className="cursor-pointer text-muted">
            Identity binding (commitment reveal)
          </summary>
          <div className="space-y-3 pt-3">
            <Field label="Agent ID (ERC-8004 token id)">
              <input
                value={agentIdReveal}
                onChange={(e) => setAgentIdReveal(e.target.value)}
                inputMode="numeric"
                className="input"
              />
            </Field>
            <Field label="Salt (bytes32)">
              <input
                value={saltReveal}
                onChange={(e) => setSaltReveal(e.target.value)}
                className="input font-mono text-xs"
              />
            </Field>
            <div className="text-xs text-muted">
              Must match the
              <code className="mx-1 px-1 bg-paper/5 rounded">
                {"<!-- x502-commitment:0x... -->"}
              </code>
              line in the GH issue/PR body.
            </div>
            {commitmentPreview && (
              <div className="text-xs font-mono break-all bg-paper/5 rounded p-2">
                {commitmentPreview}
              </div>
            )}
          </div>
        </details>

        <div className="rounded border border-paper/10 p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Bounty</span>
            <span>{formatUsdc(meta.price)}</span>
          </div>
          <div className="flex justify-between text-muted text-xs">
            <span>− verifier outcome fees ({VERIFIER_COUNT} × $0.10)</span>
            <span>−{formatUsdc(OUTCOME_FEE_PER_VERIFIER * BigInt(VERIFIER_COUNT))}</span>
          </div>
          <hr className="border-paper/10 my-1" />
          <div className="flex justify-between font-semibold">
            <span>You receive</span>
            <span className="text-accent">{formatUsdc(claimantAmount)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pipeline.status === "verifying"}
          className="w-full bg-accent text-paper rounded py-3 font-semibold disabled:opacity-50"
        >
          {pipeline.status === "verifying" ? "Verifying…" : "Submit claim"}
        </button>
      </section>

      {pipeline.status !== "idle" && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted">Status</h2>
          <PipelineStatus state={pipeline} />
        </section>
      )}
    </>
  );

  return (
    <main className={`mx-auto p-8 space-y-10 ${demoMode ? "max-w-7xl" : "max-w-3xl"}`}>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          x502
          <span className="text-muted text-base ml-3">
            services pay agents for verifiable GitHub outcomes
          </span>
        </h1>
        <p className="text-sm text-muted leading-6">
          File a claim against a vault-funded repo. The coordinator routes the claim through
          Chainlink Functions (objective fact) and N-of-M verifier agents (subjective judgment),
          then settles to your wallet on Base.
        </p>
        {demoMode && (
          <div className="text-xs text-accent">
            demo mode {demoCfg ? `· coordinator ${demoCfg.coordinator.endpoint}` : ""}
          </div>
        )}
      </header>

      {demoMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <DemoStepper
              current={stepperStep}
              commitmentForm={{
                repoSlug,
                externalId,
                recipient,
                commitment: commitmentPreview,
                salt: saltReveal,
                onSaltChange: (s) => setSaltReveal(s),
              }}
            />
          </div>
          <div className="space-y-6">{claimForm}</div>
          <div className="space-y-6">
            <VerifierTheater
              coordinatorUrl={coordinatorUrl}
              claimId={pipeline.claimId}
              agentIds={demoCfg?.verifiers.map((v) => v.agentId) ?? ["101", "102", "103"]}
            />
            <SepoliaReplay />
          </div>
        </div>
      ) : (
        claimForm
      )}

      <footer className="text-xs text-muted pt-4 border-t border-paper/10 space-y-1">
        <div>
          x402 = agents pay services. x502 = services pay agents. This is the inverse: the vault
          pays out for verified outcomes, and verifier compute is x402-paid by the coordinator from
          the anti-spam-fee budget.
        </div>
        <div>
          Sources: Base Sepolia (chainId 84532) + ERC-8004 IdentityRegistry 0x8004A8… + Chainlink
          Functions Router 0xf9B8fc…
        </div>
      </footer>

      <style jsx>{`
        .input {
          width: 100%;
          background: rgba(250, 250, 246, 0.05);
          border: 1px solid rgba(250, 250, 246, 0.1);
          border-radius: 0.25rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #0052ff;
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: child inputs are nested inside this label.
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function PipelineStatus({ state }: { state: PipelineState }) {
  if (state.status === "paid" && state.txHash) {
    return (
      <div className="rounded border border-accent/40 bg-accent/5 p-4 space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="font-semibold text-accent">Paid</span>
          <span className="text-xs text-muted">{shortHash(state.claimId!)}</span>
        </div>
        <a
          href={basescanTx(state.txHash)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline break-all"
        >
          {state.txHash}
        </a>
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm space-y-1">
        <div className="font-semibold text-red-400">Failed</div>
        <div className="text-xs text-muted">{state.error}</div>
      </div>
    );
  }

  return (
    <div className="rounded border border-paper/10 p-4 space-y-2 text-sm">
      <Step label="Anti-spam fee paid" done={state.status !== "idle"} />
      <Step label="Chainlink Functions fact delivered" done={state.factReady === true} />
      <Step label={`Verifier signatures (${state.sigs ?? 0} / 2)`} done={(state.sigs ?? 0) >= 2} />
      <Step label="Vault payout tx" done={state.status === "paid"} />
    </div>
  );
}

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={["h-3 w-3 rounded-full", done ? "bg-accent" : "bg-paper/20 animate-pulse"].join(
          " ",
        )}
      />
      <span className={done ? "text-paper" : "text-muted"}>{label}</span>
    </div>
  );
}
