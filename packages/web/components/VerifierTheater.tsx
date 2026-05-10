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
  agents: AgentSpec[];
  easExplorerBase?: string;
}) {
  const [deltas, setDeltas] = useState<Record<string, AttestationDelta>>({});
  const [fact, setFact] = useState<FactState>({});
  const [payoutTx, setPayoutTx] = useState<string | undefined>();

  useEffect(() => {
    if (!claimId) return;
    setDeltas({});
    setFact({});
    setPayoutTx(undefined);
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
    <section className="x502-card p-6 sm:p-7 space-y-5">
      <div className="space-y-1">
        <h2 className="x502-eyebrow">Verifier theater</h2>
        <p className="text-text-muted text-sm leading-relaxed">
          Each verifier identity runs the <code className="x502-mono">x502-verify</code> skill in
          their own Claude. EAS attestations land here as the coordinator observes them on chain.
        </p>
      </div>

      <FactBlock fact={fact} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agentSpecs.map((s) => {
          const agent = agentColumnFromSpec(s, deltas);
          return <AgentCard key={s.agentId} agent={agent} explorer={easExplorerBase} />;
        })}
      </div>

      {payoutTx && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 space-y-1.5 animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-success font-medium text-sm">Payout settled</span>
            <span className="x502-pill-success">on chain</span>
          </div>
          <a
            href={`https://sepolia.basescan.org/tx/${payoutTx}`}
            target="_blank"
            rel="noreferrer"
            className="block x502-mono text-success break-all hover:underline"
          >
            {payoutTx}
          </a>
        </div>
      )}
    </section>
  );
}

function FactBlock({ fact }: { fact: FactState }) {
  const empty = fact.status === undefined;
  return (
    <div
      className={[
        "rounded-xl border p-4 space-y-2.5 transition-colors",
        empty ? "border-line bg-ink-700/40" : "border-line-strong bg-ink-700/60",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <span className="x502-eyebrow">DON fact</span>
        <FactBadge fact={fact} />
      </div>
      {!empty && fact.mergedBlock && fact.mergedBlock !== "0" && (
        <Row label="mergedBlock" value={fact.mergedBlock} mono />
      )}
      {!empty && fact.ghAuthorBinding && (
        <Row
          label="ghAuthorBinding"
          value={shortHash(fact.ghAuthorBinding as `0x${string}`)}
          mono
        />
      )}
      {empty && (
        <p className="text-xs text-text-muted">
          Awaiting Chainlink Functions response — usually 30–60s on Base Sepolia.
        </p>
      )}
    </div>
  );
}

function FactBadge({ fact }: { fact: FactState }) {
  if (fact.status === undefined) {
    return (
      <span className="x502-pill">
        <span className="h-1.5 w-1.5 rounded-full bg-text-faint animate-pulse" />
        awaiting
      </span>
    );
  }
  if (fact.status === 1) {
    return <span className="x502-pill-success">accepted · status 1</span>;
  }
  return <span className="x502-pill-danger">rejected · status {fact.status}</span>;
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

function AgentCard({
  agent,
  explorer,
}: {
  agent: AgentColumn;
  explorer?: string;
}) {
  const attested = agent.status === "attested";
  return (
    <article
      className={[
        "rounded-xl border p-4 transition-all duration-200 space-y-2.5",
        attested
          ? "border-accent/50 bg-accent/10 shadow-glow animate-fade-up"
          : "border-line bg-ink-700/40",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-text-strong">
          agent <span className="font-mono">{agent.agentId}</span>
        </span>
        {attested ? (
          <span className="x502-pill-accent">attested</span>
        ) : (
          <span className="x502-pill">
            <span className="h-1.5 w-1.5 rounded-full bg-text-faint animate-pulse" />
            waiting
          </span>
        )}
      </div>
      <p className="x502-mono text-text-muted">
        {shortHash(agent.attesterAddress as `0x${string}`)}
      </p>
      {agent.uid && (
        <p className="x502-mono break-all">
          {explorer ? (
            <a
              href={`${explorer.replace(/\/$/, "")}/${agent.uid}`}
              target="_blank"
              rel="noreferrer"
              className="x502-link"
            >
              uid {shortHash(agent.uid as `0x${string}`)} ↗
            </a>
          ) : (
            <span className="text-text-muted">uid {shortHash(agent.uid as `0x${string}`)}</span>
          )}
        </p>
      )}
    </article>
  );
}
