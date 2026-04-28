/// Round-trip tests for each bounty kind, plus a custom DecisionPolicy that
/// inspects the commitment reveal — verifies the agent forwards
/// agentIdReveal + saltReveal to the policy and returns a 403 when the
/// policy rejects.

import { http, type Address, type Hex, createWalletClient, recoverTypedDataAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { describe, expect, it } from "vitest";

import {
  ATTESTATION_TYPES,
  Kind,
  type KindName,
  attestationDomain,
  deriveClaimId,
  deriveCommitment,
  repoIdFromSlug,
} from "@x502/shared";

import {
  AcceptAllPolicy,
  type DecisionOutcome,
  type DecisionPolicy,
  type VerifyContext,
  buildVerifierApp,
} from "../src/index.js";

const VAULT = "0x4444444444444444444444444444444444444444" as const;
const RECIPIENT = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as const;
const REPO_SLUG = "x502-protocol/demo";

function makeApp(policy: DecisionPolicy) {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = createWalletClient({ account, chain: foundry, transport: http() });
  const app = buildVerifierApp({
    signer: { agentId: 100n, vault: VAULT, chainId: foundry.id, account, wallet },
    policy,
    repoSlugResolver: () => REPO_SLUG,
  });
  return { app, account };
}

async function postVerify(app: ReturnType<typeof makeApp>["app"], body: Record<string, unknown>) {
  return app.request("/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /health", () => {
  it("reports agent identity + EIP-712 domain", async () => {
    const { app, account } = makeApp(new AcceptAllPolicy());
    const r = await app.request("/health");
    expect(r.status).toBe(200);
    const j = (await r.json()) as {
      agentId: string;
      address: Address;
      vault: Address;
      chainId: number;
    };
    expect(j.agentId).toBe("100");
    expect(j.address.toLowerCase()).toBe(account.address.toLowerCase());
    expect(j.vault.toLowerCase()).toBe(VAULT.toLowerCase());
    expect(j.chainId).toBe(foundry.id);
  });
});

describe("POST /verify — all kinds round-trip", () => {
  const cases: Array<{ name: KindName; kind: number }> = [
    { name: "report", kind: Kind.Report },
    { name: "triage", kind: Kind.Triage },
    { name: "fix", kind: Kind.Fix },
    { name: "docs_tests", kind: Kind.DocsTests },
  ];

  for (const c of cases) {
    it(`signs a valid attestation for kind=${c.name}`, async () => {
      const { app, account } = makeApp(new AcceptAllPolicy());
      const repoId = repoIdFromSlug(REPO_SLUG);
      const externalId = 7n;
      const factHash = `0x${"ab".repeat(32)}` as Hex;
      const deadline = 9_999_999_999n;

      const r = await postVerify(app, {
        repoId,
        externalId: externalId.toString(),
        kind: c.kind,
        recipient: RECIPIENT,
        deadline: deadline.toString(),
        factHash,
      });
      expect(r.status).toBe(200);

      const body = (await r.json()) as {
        accepted: boolean;
        attestation: { claimId: Hex; recipient: Address; deadline: string; factHash: Hex };
        signature: Hex;
      };
      expect(body.accepted).toBe(true);
      expect(body.attestation.claimId).toBe(deriveClaimId(repoId, externalId, c.kind));

      // Signature is bound to the kind via the claimId; recovery returns the agent.
      const recovered = await recoverTypedDataAddress({
        domain: attestationDomain(foundry.id, VAULT),
        types: ATTESTATION_TYPES,
        primaryType: "Attestation",
        message: {
          claimId: body.attestation.claimId,
          recipient: body.attestation.recipient,
          deadline: BigInt(body.attestation.deadline),
          factHash: body.attestation.factHash,
        },
        signature: body.signature,
      });
      expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
    });
  }
});

describe("POST /verify — commitment binding", () => {
  /// Demo commitment values from the published Issue #2 / PR #3 demo personas.
  const ALICE_AGENT_ID = 101n;
  const ALICE_SALT = "0x000000000000000000000000000000000000000000000000000000000000beef" as const;

  /// A policy that rejects unless the reveal hashes to the expected commitment.
  class CommitmentPolicy implements DecisionPolicy {
    constructor(private readonly expected: Hex) {}
    async decide(ctx: VerifyContext): Promise<DecisionOutcome> {
      if (ctx.agentIdReveal === undefined || ctx.saltReveal === undefined) {
        return { accept: false, reason: "no reveal" };
      }
      const repoId = repoIdFromSlug(ctx.repoSlug);
      const got = deriveCommitment(
        ctx.agentIdReveal,
        repoId,
        ctx.externalId,
        ctx.saltReveal,
      ).toLowerCase();
      if (got !== this.expected.toLowerCase()) return { accept: false, reason: "mismatch" };
      return { accept: true, reason: "ok" };
    }
  }

  it("accepts when reveal matches the expected commitment", async () => {
    const repoId = repoIdFromSlug(REPO_SLUG);
    const externalId = 2n;
    const expected = deriveCommitment(ALICE_AGENT_ID, repoId, externalId, ALICE_SALT);
    const { app } = makeApp(new CommitmentPolicy(expected));

    const r = await postVerify(app, {
      repoId,
      externalId: externalId.toString(),
      kind: Kind.Report,
      recipient: RECIPIENT,
      deadline: "9999999999",
      factHash: `0x${"cd".repeat(32)}`,
      agentIdReveal: ALICE_AGENT_ID.toString(),
      saltReveal: ALICE_SALT,
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { accepted: boolean };
    expect(j.accepted).toBe(true);
  });

  it("rejects when the salt is wrong", async () => {
    const repoId = repoIdFromSlug(REPO_SLUG);
    const externalId = 2n;
    const expected = deriveCommitment(ALICE_AGENT_ID, repoId, externalId, ALICE_SALT);
    const { app } = makeApp(new CommitmentPolicy(expected));

    const r = await postVerify(app, {
      repoId,
      externalId: externalId.toString(),
      kind: Kind.Report,
      recipient: RECIPIENT,
      deadline: "9999999999",
      factHash: `0x${"cd".repeat(32)}`,
      agentIdReveal: ALICE_AGENT_ID.toString(),
      saltReveal: `0x${"ff".repeat(32)}`, // wrong salt
    });
    expect(r.status).toBe(403);
    const j = (await r.json()) as { reason: string };
    expect(j.reason).toMatch(/mismatch/);
  });

  it("rejects when no reveal is provided", async () => {
    const repoId = repoIdFromSlug(REPO_SLUG);
    const externalId = 2n;
    const expected = deriveCommitment(ALICE_AGENT_ID, repoId, externalId, ALICE_SALT);
    const { app } = makeApp(new CommitmentPolicy(expected));

    const r = await postVerify(app, {
      repoId,
      externalId: externalId.toString(),
      kind: Kind.Report,
      recipient: RECIPIENT,
      deadline: "9999999999",
      factHash: `0x${"cd".repeat(32)}`,
    });
    expect(r.status).toBe(403);
    const j = (await r.json()) as { reason: string };
    expect(j.reason).toMatch(/no reveal/);
  });
});

describe("POST /verify — bad input", () => {
  it("404s on unknown repoId", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const wallet = createWalletClient({ account, chain: foundry, transport: http() });
    const app = buildVerifierApp({
      signer: { agentId: 100n, vault: VAULT, chainId: foundry.id, account, wallet },
      policy: new AcceptAllPolicy(),
      repoSlugResolver: () => undefined,
    });
    const r = await postVerify(app, {
      repoId: `0x${"ee".repeat(32)}`,
      externalId: "1",
      kind: Kind.Report,
      recipient: RECIPIENT,
      deadline: "9999999999",
      factHash: `0x${"cd".repeat(32)}`,
    });
    expect(r.status).toBe(404);
  });

  it("400s on bad factHash length", async () => {
    const { app } = makeApp(new AcceptAllPolicy());
    const r = await postVerify(app, {
      repoId: repoIdFromSlug(REPO_SLUG),
      externalId: "1",
      kind: Kind.Report,
      recipient: RECIPIENT,
      deadline: "9999999999",
      factHash: "0xabcd", // too short
    });
    expect(r.status).toBe(400);
  });
});
