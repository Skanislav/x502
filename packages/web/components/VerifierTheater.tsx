"use client";

import { useEffect, useState } from "react";
import { subscribeDemoEvents } from "../lib/events";
import { shortHash } from "../lib/format";

type Status = "idle" | "signed";

interface AgentColumn {
  agentId: string;
  status: Status;
  signature?: string;
  signedAt?: number;
}

interface FactState {
  status?: number;
  mergedBlock?: string;
  ghAuthorBinding?: string;
}

export function VerifierTheater({
  coordinatorUrl,
  claimId,
  agentIds,
}: {
  coordinatorUrl: string;
  claimId: string | undefined;
  agentIds: string[];
}) {
  const [agents, setAgents] = useState<Record<string, AgentColumn>>(() =>
    Object.fromEntries(agentIds.map((id) => [id, { agentId: id, status: "idle" }])),
  );
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
        if (event.type === "verifier.signed") {
          setAgents((s) => ({
            ...s,
            [event.agentId]: {
              ...s[event.agentId]!,
              status: "signed",
              signature: event.signature,
              signedAt: event.ts,
            },
          }));
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
        attestations land here as they're pushed to the coordinator.
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
        {agentIds.map((id) => {
          const a = agents[id]!;
          return <AgentColumnCard key={id} agent={a} />;
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

function AgentColumnCard({ agent }: { agent: AgentColumn }) {
  const className =
    agent.status === "signed" ? "border-accent/60 bg-accent/5" : "border-paper/10 animate-pulse";
  return (
    <div className={`rounded border ${className} p-3 text-xs space-y-2`}>
      <div className="flex justify-between items-baseline">
        <span className="font-semibold">agent {agent.agentId}</span>
        <span className={agent.status === "signed" ? "text-accent" : "text-muted"}>
          {agent.status === "signed" ? "✓ signed" : "waiting…"}
        </span>
      </div>
      {agent.signature && (
        <p className="text-[10px] font-mono break-all text-muted">
          sig {shortHash(agent.signature as `0x${string}`)}
        </p>
      )}
    </div>
  );
}
