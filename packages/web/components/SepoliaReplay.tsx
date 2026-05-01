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

  if (error) return <p className="text-xs text-muted">No Sepolia fixture present yet.</p>;
  if (!data) return <p className="text-xs text-muted">Loading…</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-xs uppercase tracking-widest text-muted">
        Sepolia proof · {data.network.label} ({data.network.chainId})
      </h2>
      <div className="text-xs space-y-1">
        <div className="flex justify-between text-muted">
          <span>Vault</span>
          <span className="font-mono">{shortHash(data.vault)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Fact receiver</span>
          <span className="font-mono">{shortHash(data.factReceiver)}</span>
        </div>
      </div>
      {data.runs.map((r) => (
        <ReplayRunCard key={r.claimId} run={r} explorer={data.network.explorer} />
      ))}
    </section>
  );
}

function ReplayRunCard({ run, explorer }: { run: ReplayRun; explorer: string }) {
  const isPlaceholder = run._status === "placeholder";
  const txUrl = run.payoutTx === "0x".padEnd(66, "0") ? null : `${explorer}/tx/${run.payoutTx}`;
  return (
    <div
      className={[
        "rounded border p-3 text-xs space-y-2",
        isPlaceholder ? "border-paper/10 opacity-60" : "border-accent/40 bg-accent/5",
      ].join(" ")}
    >
      <div className="flex justify-between items-baseline">
        <span className="font-semibold">
          {run.kind} · {run.repo} #{run.externalId}
        </span>
        {isPlaceholder && <span className="text-[10px] text-muted">placeholder</span>}
      </div>
      <div className="flex justify-between text-muted">
        <span>claimId</span>
        <span className="font-mono">{shortHash(run.claimId)}</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>factHash</span>
        <span className="font-mono">{shortHash(run.factHash)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">paid</span>
        <span className="text-accent">{run.claimantAmountUsdc} USDC</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>signers</span>
        <span>{run.verifierSignatures.map((s) => `#${s.agentId}`).join(" · ")}</span>
      </div>
      {txUrl && (
        <a
          href={txUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline break-all"
        >
          {run.payoutTx}
        </a>
      )}
    </div>
  );
}

// re-export so a parent can render it within an existing layout helper.
export { formatUsdc };
