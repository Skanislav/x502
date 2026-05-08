"use client";

import type { KindName } from "@x502/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Address, type Hex, isAddress } from "viem";

import { DemoStepper, type StepKey, stepFromPipeline } from "@/components/DemoStepper";
import { SepoliaReplay } from "@/components/SepoliaReplay";
import { VerifierTheater } from "@/components/VerifierTheater";
import { type PipelineState, mapPoll, previewCommitment } from "@/lib/claim-ui";
import { CoordinatorClient } from "@/lib/coordinator";
import { basescanTx, formatUsdc, shortHash } from "@/lib/format";

const DEFAULT_COORDINATOR = process.env.NEXT_PUBLIC_COORDINATOR_URL ?? "http://localhost:8787";

interface DemoConfig {
  coordinator: { endpoint: string };
  verifiers: Array<{ agentId: string; address: string }>;
  repo: { slug: string };
  chainId?: number;
  contracts?: { eas?: string };
}

function easExplorer(chainId: number | undefined): string | undefined {
  if (chainId === 8453) return "https://base.easscan.org/attestation/view";
  if (chainId === 84532) return "https://base-sepolia.easscan.org/attestation/view";
  return undefined;
}

const KIND_META: Record<KindName, { label: string; price: bigint; description: string }> = {
  report: {
    label: "report",
    price: 50_000n,
    description: "novel + reproducible bug report",
  },
  triage: {
    label: "triage",
    price: 20_000n,
    description: "added substantive labels + dedup links",
  },
  fix: {
    label: "fix",
    price: 500_000n,
    description: "merged PR closing a linked issue",
  },
  docs_tests: {
    label: "docs_tests",
    price: 300_000n,
    description: "merged PR adding tests or fixing stale docs",
  },
};

const OUTCOME_FEE_PER_VERIFIER = 1_000n;
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

  return (
    <main
      className={`mx-auto px-6 sm:px-8 lg:px-10 pt-10 pb-20 space-y-12 ${demoMode ? "max-w-7xl" : "max-w-4xl"}`}
    >
      <Hero demoMode={demoMode} demoCfg={demoCfg} />

      {demoMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-5 space-y-6 animate-fade-up">
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
          <div className="lg:col-span-7 space-y-6 animate-fade-up [animation-delay:80ms]">
            <ClaimForm
              coordinatorUrl={coordinatorUrl}
              setCoordinatorUrl={setCoordinatorUrl}
              repoSlug={repoSlug}
              setRepoSlug={setRepoSlug}
              externalId={externalId}
              setExternalId={setExternalId}
              kind={kind}
              setKind={setKind}
              recipient={recipient}
              setRecipient={setRecipient}
              agentIdReveal={agentIdReveal}
              setAgentIdReveal={setAgentIdReveal}
              saltReveal={saltReveal}
              setSaltReveal={setSaltReveal}
              commitmentPreview={commitmentPreview}
              onSubmit={submit}
              pipeline={pipeline}
              meta={meta}
              claimantAmount={claimantAmount}
              demoMode={demoMode}
            />

            <VerifierTheater
              coordinatorUrl={coordinatorUrl}
              claimId={pipeline.claimId}
              agents={
                demoCfg?.verifiers.map((v) => ({
                  agentId: v.agentId,
                  address: v.address,
                })) ?? [
                  { agentId: "101", address: "0x0000000000000000000000000000000000000101" },
                  { agentId: "102", address: "0x0000000000000000000000000000000000000102" },
                  { agentId: "103", address: "0x0000000000000000000000000000000000000103" },
                ]
              }
              easExplorerBase={easExplorer(demoCfg?.chainId)}
            />

            <SepoliaReplay />
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-up">
          <ClaimForm
            coordinatorUrl={coordinatorUrl}
            setCoordinatorUrl={setCoordinatorUrl}
            repoSlug={repoSlug}
            setRepoSlug={setRepoSlug}
            externalId={externalId}
            setExternalId={setExternalId}
            kind={kind}
            setKind={setKind}
            recipient={recipient}
            setRecipient={setRecipient}
            agentIdReveal={agentIdReveal}
            setAgentIdReveal={setAgentIdReveal}
            saltReveal={saltReveal}
            setSaltReveal={setSaltReveal}
            commitmentPreview={commitmentPreview}
            onSubmit={submit}
            pipeline={pipeline}
            meta={meta}
            claimantAmount={claimantAmount}
            demoMode={demoMode}
          />
        </div>
      )}

      <Footer />
    </main>
  );
}

function Hero({
  demoMode,
  demoCfg,
}: {
  demoMode: boolean;
  demoCfg: DemoConfig | undefined;
}) {
  return (
    <header className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center gap-3">
        {demoMode ? (
          <span className="x502-pill-success">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Live · Base Sepolia
          </span>
        ) : (
          <span className="x502-pill-accent">protocol preview</span>
        )}
        <span className="x502-pill">chain 84532</span>
        <span className="x502-pill">M-of-N · EAS</span>
      </div>
      <div className="space-y-4 max-w-3xl">
        <h1 className="font-mono text-5xl sm:text-6xl font-medium tracking-tightest text-text-strong">
          x502
          <span className="ml-3 inline-block h-2 w-2 translate-y-[-0.45em] rounded-full bg-accent shadow-glow" />
        </h1>
        <p className="font-sans text-xl sm:text-2xl text-text-strong leading-snug tracking-tight">
          Services pay agents for <span className="text-accent">verifiable GitHub outcomes.</span>
        </p>
        <p className="text-text-muted text-base leading-relaxed">
          A repo owner funds a USDC vault. A claimant submits an issue or PR. Chainlink Functions
          stamps the GitHub fact on-chain. Verifier agents publish EAS attestations. The vault
          settles on Base — no custodian, no oracle of last resort.
        </p>
      </div>
      {demoMode && demoCfg && (
        <div className="x502-card-tight max-w-3xl flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Kv label="coordinator" value={demoCfg.coordinator.endpoint} mono />
          <Kv label="repo" value={demoCfg.repo.slug} mono />
          <Kv
            label="verifiers"
            value={`${demoCfg.verifiers.length} trusted (agent ${demoCfg.verifiers[0]?.agentId ?? "?"})`}
          />
        </div>
      )}
    </header>
  );
}

function Kv({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="x502-eyebrow">{label}</div>
      <div className={mono ? "font-mono text-[13px] text-text-strong" : "text-text-strong"}>
        {value}
      </div>
    </div>
  );
}

function ClaimForm({
  coordinatorUrl,
  setCoordinatorUrl,
  repoSlug,
  setRepoSlug,
  externalId,
  setExternalId,
  kind,
  setKind,
  recipient,
  setRecipient,
  agentIdReveal,
  setAgentIdReveal,
  saltReveal,
  setSaltReveal,
  commitmentPreview,
  onSubmit,
  pipeline,
  meta,
  claimantAmount,
  demoMode,
}: {
  coordinatorUrl: string;
  setCoordinatorUrl: (v: string) => void;
  repoSlug: string;
  setRepoSlug: (v: string) => void;
  externalId: string;
  setExternalId: (v: string) => void;
  kind: KindName;
  setKind: (k: KindName) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  agentIdReveal: string;
  setAgentIdReveal: (v: string) => void;
  saltReveal: string;
  setSaltReveal: (v: string) => void;
  commitmentPreview: `0x${string}` | undefined;
  onSubmit: () => Promise<void>;
  pipeline: PipelineState;
  meta: { label: string; price: bigint; description: string };
  claimantAmount: bigint;
  demoMode: boolean;
}) {
  const [bindingOpen, setBindingOpen] = useState(demoMode);
  return (
    <section className="x502-card p-6 sm:p-7 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="x502-eyebrow">File a claim</h2>
          <p className="text-text-muted text-sm">
            POST to the coordinator. The pipeline runs from here.
          </p>
        </div>
        <PipelinePill state={pipeline} />
      </div>

      <Field label="Coordinator">
        <input
          type="text"
          value={coordinatorUrl}
          onChange={(e) => setCoordinatorUrl(e.target.value)}
          className="x502-input"
          placeholder="http://localhost:8787"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Repo (owner / name)">
          <input
            value={repoSlug}
            onChange={(e) => setRepoSlug(e.target.value)}
            className="x502-input"
            placeholder="acme/widgets"
          />
        </Field>
        <Field label="Issue or PR number">
          <input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            inputMode="numeric"
            className="x502-input"
            placeholder="123"
          />
        </Field>
      </div>

      <div className="space-y-2.5">
        <span className="x502-eyebrow">Bounty kind</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(Object.keys(KIND_META) as KindName[]).map((k) => {
            const m = KIND_META[k];
            const selected = k === kind;
            return (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={[
                  "group text-left rounded-xl border p-3.5 transition-all duration-150",
                  selected
                    ? "border-accent bg-accent/10 shadow-glow"
                    : "border-line bg-ink-700/60 hover:border-line-strong hover:bg-ink-600/60",
                ].join(" ")}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={[
                      "font-mono text-base",
                      selected ? "text-text-strong" : "text-text-strong",
                    ].join(" ")}
                  >
                    {m.label}
                  </span>
                  <span
                    className={[
                      "font-mono text-sm tabular-nums",
                      selected ? "text-accent" : "text-text-muted",
                    ].join(" ")}
                  >
                    {formatUsdc(m.price)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-snug text-text-muted">{m.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Recipient (your wallet)">
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          className="x502-input-mono"
          spellCheck={false}
        />
      </Field>

      <div className="x502-card-tight border-line/80 bg-ink-700/50 space-y-3">
        <button
          type="button"
          onClick={() => setBindingOpen((v) => !v)}
          aria-expanded={bindingOpen}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <span className="space-y-0.5">
            <span className="block x502-eyebrow">Identity binding · commitment reveal</span>
            <span className="block text-xs text-text-muted">
              Pre-image of the <code className="font-mono">x502-commitment</code> marker on GitHub.
            </span>
          </span>
          <Chevron open={bindingOpen} />
        </button>
        {bindingOpen && (
          <div className="space-y-3 pt-2 animate-fade-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Agent ID (ERC-8004 token id)">
                <input
                  value={agentIdReveal}
                  onChange={(e) => setAgentIdReveal(e.target.value)}
                  inputMode="numeric"
                  className="x502-input"
                />
              </Field>
              <Field label="Salt (bytes32)">
                <input
                  value={saltReveal}
                  onChange={(e) => setSaltReveal(e.target.value)}
                  className="x502-input-mono"
                  spellCheck={false}
                />
              </Field>
            </div>
            {commitmentPreview && (
              <div className="rounded-lg border border-line bg-ink-800/80 p-3 space-y-1.5">
                <div className="x502-eyebrow">commitment</div>
                <code className="block font-mono text-[12.5px] leading-relaxed text-text-strong break-all">
                  {commitmentPreview}
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-ink-700/40 p-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Bounty</span>
          <span className="font-mono tabular-nums text-text-strong">{formatUsdc(meta.price)}</span>
        </div>
        <div className="flex justify-between text-text-muted text-xs">
          <span>
            verifier outcome fees ({VERIFIER_COUNT} × {formatUsdc(OUTCOME_FEE_PER_VERIFIER)})
          </span>
          <span className="font-mono tabular-nums">
            −{formatUsdc(OUTCOME_FEE_PER_VERIFIER * BigInt(VERIFIER_COUNT))}
          </span>
        </div>
        <div className="border-t border-line my-1.5" />
        <div className="flex justify-between font-medium">
          <span>You receive</span>
          <span className="font-mono tabular-nums text-accent">{formatUsdc(claimantAmount)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pipeline.status === "verifying"}
        className="x502-button w-full"
      >
        {pipeline.status === "verifying" ? (
          <>
            <Spinner /> Verifying…
          </>
        ) : (
          <>
            Submit claim
            <span aria-hidden className="text-white/60">
              →
            </span>
          </>
        )}
      </button>

      {pipeline.status !== "idle" && <PipelineStatus state={pipeline} />}
    </section>
  );
}

function PipelineStatus({ state }: { state: PipelineState }) {
  if (state.status === "paid" && state.txHash) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/10 p-4 space-y-2 animate-fade-up">
        <div className="flex justify-between items-baseline">
          <span className="font-medium text-success flex items-center gap-2">
            <CheckIcon /> Paid
          </span>
          {state.claimId && (
            <span className="x502-mono text-text-muted">claim {shortHash(state.claimId)}</span>
          )}
        </div>
        <a
          href={basescanTx(state.txHash)}
          target="_blank"
          rel="noreferrer"
          className="block x502-mono text-success break-all hover:underline"
        >
          {state.txHash}
        </a>
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm space-y-1 animate-fade-up">
        <div className="font-medium text-danger flex items-center gap-2">
          <XIcon /> Failed
        </div>
        <div className="text-xs text-text-muted whitespace-pre-wrap break-words">{state.error}</div>
      </div>
    );
  }

  // Verifying — render the four-stage pipeline as a horizontal track.
  const stages: Array<{ label: string; done: boolean }> = [
    { label: "Anti-spam fee", done: state.status !== "idle" },
    { label: "Chainlink fact", done: state.factReady === true },
    { label: `Verifier sigs (${state.sigs ?? 0}/2)`, done: (state.sigs ?? 0) >= 2 },
    { label: "Vault payout", done: state.status === "paid" },
  ];

  return (
    <div className="rounded-xl border border-line bg-ink-700/40 p-4 space-y-3 animate-fade-up">
      <div className="x502-eyebrow">Pipeline</div>
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stages.map((s, i) => (
          <li
            key={s.label}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
              s.done
                ? "border border-accent/40 bg-accent/10 text-text-strong"
                : "border border-line bg-ink-800/60 text-text-muted",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full shrink-0",
                s.done
                  ? "bg-accent"
                  : i === stages.findIndex((x) => !x.done)
                    ? "bg-accent/70 animate-pulse-ring"
                    : "bg-text-faint",
              ].join(" ")}
            />
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PipelinePill({ state }: { state: PipelineState }) {
  if (state.status === "idle") return <span className="x502-pill">idle</span>;
  if (state.status === "paid") return <span className="x502-pill-success">paid</span>;
  if (state.status === "failed") return <span className="x502-pill-danger">failed</span>;
  return (
    <span className="x502-pill-accent">
      <Spinner small /> verifying
    </span>
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
    // biome-ignore lint/a11y/noLabelWithoutControl: child input is rendered inside this label.
    <label className="block space-y-1.5">
      <span className="x502-eyebrow">{label}</span>
      {children}
    </label>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-150 text-text-muted ${open ? "rotate-180" : ""}`}
      role="img"
      aria-label={open ? "collapse" : "expand"}
    >
      <title>{open ? "collapse" : "expand"}</title>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="checkmark"
    >
      <title>checkmark</title>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="error"
    >
      <title>error</title>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? "h-3 w-3" : "h-4 w-4";
  return (
    <svg
      className={`${size} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="loading"
    >
      <title>loading</title>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line pt-6 space-y-2 text-text-muted text-sm">
      <p>
        x402 = agents pay services. <span className="text-text-strong">x502</span> = services pay
        agents. The vault settles for verified outcomes; verifier compute is x402-paid by the
        coordinator from the anti-spam-fee budget.
      </p>
      <p className="text-xs">
        Sources: Base Sepolia (chainId 84532) · ERC-8004 IdentityRegistry{" "}
        <code className="x502-mono text-text-strong">0x8004A8…</code> · Chainlink Functions Router{" "}
        <code className="x502-mono text-text-strong">0xf9B8fc…</code>.
      </p>
    </footer>
  );
}
