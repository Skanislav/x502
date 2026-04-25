import { describe, it, expect } from "vitest";
import {
  createWalletClient,
  http,
  type Address,
  type Hex,
  recoverTypedDataAddress,
  zeroAddress,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { foundry } from "viem/chains";

import {
  ATTESTATION_TYPES,
  attestationDomain,
  deriveClaimId,
  Kind,
  repoIdFromSlug,
} from "@x502/shared";

import { buildVerifierApp, AcceptAllPolicy, RejectAllPolicy } from "../src/index.js";

function makeApp(opts: { policy: "accept" | "reject"; vault?: Address }) {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: foundry, transport: http() });
  const vault = opts.vault ?? "0x1111111111111111111111111111111111111111";
  const app = buildVerifierApp({
    signer: { agentId: 100n, vault, chainId: foundry.id, account, wallet },
    policy: opts.policy === "accept" ? new AcceptAllPolicy() : new RejectAllPolicy(),
    repoSlugResolver: () => "x502-protocol/demo",
  });
  return { app, account, vault };
}

describe("verifier-agent /verify", () => {
  it("returns 400 on malformed body", async () => {
    const { app } = makeApp({ policy: "accept" });
    const res = await app.request("/verify", {
      method: "POST",
      body: JSON.stringify({ junk: true }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 when policy rejects", async () => {
    const { app } = makeApp({ policy: "reject" });
    const repoId = repoIdFromSlug("x502-protocol/demo");
    const res = await app.request("/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repoId,
        externalId: "42",
        kind: Kind.Fix,
        recipient: zeroAddress,
        deadline: "1000",
        factHash: "0x" + "ab".repeat(32),
      }),
    });
    expect(res.status).toBe(403);
  });

  it("returns a signature that recovers to the agent address", async () => {
    const { app, account, vault } = makeApp({ policy: "accept" });
    const repoId = repoIdFromSlug("x502-protocol/demo");
    const externalId = 42n;
    const kind = Kind.Fix;
    const recipient = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as const;
    const deadline = 9_999_999_999n;
    const factHash = ("0x" + "cd".repeat(32)) as Hex;

    const res = await app.request("/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repoId,
        externalId: externalId.toString(),
        kind,
        recipient,
        deadline: deadline.toString(),
        factHash,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accepted: boolean;
      agentId: string;
      signature: Hex;
      attestation: { claimId: Hex; recipient: Address; deadline: string; factHash: Hex };
    };
    expect(body.accepted).toBe(true);

    // Derived claimId matches what the contract would compute
    expect(body.attestation.claimId).toBe(deriveClaimId(repoId, externalId, kind));

    // Signature recovers to the agent's address (locks EIP-712 wire format)
    const recovered = await recoverTypedDataAddress({
      domain: attestationDomain(foundry.id, vault),
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
});
