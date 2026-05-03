"use client";

import { useEffect, useState } from "react";
import { subscribeDemoEvents } from "../lib/events";
import { shortHash } from "../lib/format";

type Status = "idle" | "attested";

interface AgentSpec {
  agentId: string;
  address: string;
}

interface AgentColumn {
  agentId: string;
  attesterAddress: string;
  status: Status;
  uid?: string;
}

interface AttestationDelta {
  status: "attested";
  uid: string;
}

interface FactState {
  status?: number;
  mergedBlock?: string;
  ghAuthorBinding?: string;
}

export function VerifierTheater({
  coordinatorUrl,
  claimId,
  agents: agentSpecs,
  easExplorerBase,
}: {
  coordinatorUrl: string;
  claimId: string | undefined;
  /// (agentId, address) pairs from the demo runtime — used to map an
  /// observed attester back to the verifier identity for display.
  agents: AgentSpec[];
  /// Optional. Base URL for an attestation explorer (e.g. attest.org). When
  /// set, each attested column links to `${easExplorerBase}/${uid}`.
  easExplorerBase?: string;
}) {
  const [deltas, setDeltas] = useState<Record<string, AttestationDelta>>({});
  const [fact, setFact] = useState<FactState>({});
  const [payoutTx, setPayoutTx] = useState<string | undefined>();

  useEffect(() => {
    if (!claimId) return;
    const sub = subscribeDemoEvents(`${coordinatorUrl}/events`, {
      claimId,
      onEvent: (event) => {
        if (event.type === "fact.delivered") {
          setFact({
            status: event.status,
            mergedBlock: event.mergedBlock,
            ghAuthorBinding: event.ghAuthorBinding,
          });
        }
        if (event.type === "attestation.observed") {
          const key = event.attester.toLowerCase();
          setDeltas((s) => ({ ...s, [key]: { status: "attested", uid: event.uid } }));
        }
        if (event.type === "payout.confirmed") {
          setPayoutTx(event.txHash);
        }
      },
    });
    return () => sub.close();
  }, [coordinatorUrl, claimId]);

  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-muted">Verifier theater</h2>
      <p className="text-[11px] text-muted leading-snug">
        Each verifier identity runs the <code>x502-verify</code> skill in their own Claude. Their
        EAS attestations land here as the coordinator observes them on chain.
      </p>

      <div className="rounded border border-paper/10 p-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted">DON fact</span>
          <span>
            {fact.status === undefined ? (
              <span className="text-muted">awaiting…</span>
            ) : fact.status === 1 ? (
              <span className="text-accent">accepted (status=1)</span>
            ) : (
              <span className="text-red-400">rejected (status={fact.status})</span>
            )}
          </span>
        </div>
        {fact.mergedBlock && fact.mergedBlock !== "0" && (
          <div className="flex justify-between text-muted">
            <span>mergedBlock</span>
            <span className="font-mono">{fact.mergedBlock}</span>
          </div>
        )}
        {fact.ghAuthorBinding && (
          <div className="flex justify-between text-muted">
            <span>ghAuthorBinding</span>
            <span className="font-mono">{shortHash(fact.ghAuthorBinding as `0x${string}`)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {agentSpecs.map((s) => {
          const agent = agentColumnFromSpec(s, deltas);
          return <AgentColumnCard key={s.agentId} agent={agent} explorer={easExplorerBase} />;
        })}
      </div>

      {payoutTx && (
        <div className="rounded border border-accent/40 bg-accent/5 p-3 text-xs">
          <span className="text-muted">payout tx </span>
          <span className="font-mono break-all">{payoutTx}</span>
        </div>
      )}
    </section>
  );
}

export function agentColumnFromSpec(
  spec: AgentSpec,
  deltas: Record<string, AttestationDelta>,
): AgentColumn {
  const delta = deltas[spec.address.toLowerCase()];
  return {
    agentId: spec.agentId,
    attesterAddress: spec.address,
    status: delta?.status ?? "idle",
    uid: delta?.uid,
  };
}

function AgentColumnCard({
  agent,
  explorer,
}: {
  agent: AgentColumn;
  explorer?: string;
}) {
  const className =
    agent.status === "attested" ? "border-accent/60 bg-accent/5" : "border-paper/10 animate-pulse";
  return (
    <div className={`rounded border ${className} p-3 text-xs space-y-2`}>
      <div className="flex justify-between items-baseline">
        <span className="font-semibold">agent {agent.agentId}</span>
        <span className={agent.status === "attested" ? "text-accent" : "text-muted"}>
          {agent.status === "attested" ? "✓ attested" : "waiting…"}
        </span>
      </div>
      <p className="text-[10px] font-mono break-all text-muted">
        {shortHash(agent.attesterAddress as `0x${string}`)}
      </p>
      {agent.uid && (
        <p className="text-[10px] font-mono break-all">
          {explorer ? (
            <a
              href={`${explorer.replace(/\/$/, "")}/${agent.uid}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              uid {shortHash(agent.uid as `0x${string}`)}
            </a>
          ) : (
            <span className="text-muted">uid {shortHash(agent.uid as `0x${string}`)}</span>
          )}
        </p>
      )}
    </div>
  );
}
