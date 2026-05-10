"use client";

import { useEffect, useState } from "react";
import { basescanTx, formatUsdc, shortHash } from "../lib/format";

interface VerifierSig {
  agentId: string;
  signature: string;
}

interface ReplayRun {
  kind: string;
  repo: string;
  externalId: string;
  claimId: string;
  factHash: string;
  payoutTx: string;
  claimant: string;
  claimantAmountUsdc: string;
  verifierSignatures: VerifierSig[];
  _status?: string;
}

interface ReplayFixture {
  network: { chainId: number; label: string; explorer: string };
  vault: string;
  factReceiver: string;
  runs: ReplayRun[];
}

export function SepoliaReplay() {
  const [data, setData] = useState<ReplayFixture | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/sepolia-replay")
      .then((r) => (r.ok ? (r.json() as Promise<ReplayFixture>) : Promise.reject(r.status)))
      .then((d) => setData(d))
      .catch(() => setError("fixture unavailable"));
  }, []);

  if (error) {
    return (
      <section className="x502-card p-6 space-y-2">
        <h2 className="x502-eyebrow">Sepolia proof</h2>
        <p className="text-text-muted text-sm">No Sepolia fixture present yet.</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="x502-card p-6 space-y-2">
        <h2 className="x502-eyebrow">Sepolia proof</h2>
        <p className="text-text-muted text-sm">Loading…</p>
      </section>
    );
  }

  // We deliberately don't render placeholder rows in the live UI — they
  // are scaffolding for ops to fill in and would otherwise lie about
  // having a real on-chain proof.
  const liveRuns = data.runs.filter((r) => r._status !== "placeholder");
  const vaultZero = /^0x0+$/i.test(data.vault);
  const factZero = /^0x0+$/i.test(data.factReceiver);
  const hasLive = liveRuns.length > 0 && !vaultZero && !factZero;

  if (!hasLive) {
    return (
      <section className="x502-card p-6 sm:p-7 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="x502-eyebrow">
            Sepolia proof · {data.network.label} ({data.network.chainId})
          </h2>
          <span className="x502-pill">no live runs yet</span>
        </div>
        <p className="text-text-muted text-sm leading-relaxed">
          No recorded payout in{" "}
          <code className="x502-mono">demo/scripts/sepolia-replay.fixture.json</code> yet. Run a
          claim through the coordinator and capture the claimId, factHash, attestation UID, and
          payout tx into the fixture to populate this card.
        </p>
      </section>
    );
  }

  return (
    <section className="x502-card p-6 sm:p-7 space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="x502-eyebrow">
          Sepolia proof · {data.network.label} ({data.network.chainId})
        </h2>
        <span className="x502-pill-success">on chain · {liveRuns.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Tile label="Vault" value={shortHash(data.vault)} />
        <Tile label="Fact receiver" value={shortHash(data.factReceiver)} />
      </div>
      <div className="space-y-3">
        {liveRuns.map((r) => (
          <ReplayRunCard key={r.claimId} run={r} explorer={data.network.explorer} />
        ))}
      </div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-700/40 p-3.5 space-y-1">
      <div className="x502-eyebrow">{label}</div>
      <div className="x502-mono text-text-strong">{value}</div>
    </div>
  );
}

function ReplayRunCard({ run, explorer }: { run: ReplayRun; explorer: string }) {
  const isPlaceholder = run._status === "placeholder";
  const txUrl = run.payoutTx === "0x".padEnd(66, "0") ? null : `${explorer}/tx/${run.payoutTx}`;
  return (
    <div
      className={[
        "rounded-xl border p-4 space-y-2.5",
        isPlaceholder ? "border-line bg-ink-700/30 opacity-70" : "border-accent/40 bg-accent/5",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-text-strong">
          <span className="font-mono">{run.kind}</span>
          <span className="text-text-muted"> · {run.repo} </span>
          <span className="font-mono">#{run.externalId}</span>
        </span>
        {isPlaceholder ? (
          <span className="x502-pill">placeholder</span>
        ) : (
          <span className="x502-pill-success">paid · {run.claimantAmountUsdc} USDC</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="claimId" value={shortHash(run.claimId)} mono />
        <Row label="factHash" value={shortHash(run.factHash)} mono />
      </div>
      <Row label="signers" value={run.verifierSignatures.map((s) => `#${s.agentId}`).join(" · ")} />
      {txUrl && (
        <a
          href={txUrl}
          target="_blank"
          rel="noreferrer"
          className="block x502-mono x502-link break-all"
        >
          {run.payoutTx} ↗
        </a>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={mono ? "x502-mono text-text-strong" : "text-text-strong"}>{value}</span>
    </div>
  );
}

export { formatUsdc, basescanTx };
