import { describe, expect, it, vi } from "vitest";

import { ATTESTATION_TYPES, attestationDomain } from "@x502/shared";

import { AcceptAllPolicy, RejectAllPolicy } from "../src/decide.js";
import { signAttestation } from "../src/sign.js";

const VAULT = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = { address: "0x2222222222222222222222222222222222222222" } as const;
const ATTESTATION = {
  claimId: `0x${"11".repeat(32)}` as const,
  recipient: "0x3333333333333333333333333333333333333333" as const,
  deadline: 123n,
  factHash: `0x${"44".repeat(32)}` as const,
};

describe("signAttestation", () => {
  it("delegates through attestationTypedData shape and returns the configured agent ID", async () => {
    const wallet = { signTypedData: vi.fn(async () => `0x${"aa".repeat(65)}` as const) };

    const signed = await signAttestation(
      {
        agentId: 101n,
        vault: VAULT,
        chainId: 84532,
        account: ACCOUNT as never,
        wallet: wallet as never,
      },
      ATTESTATION,
    );

    expect(signed.agentId).toBe(101n);
    expect(signed.attestation).toBe(ATTESTATION);
    expect(wallet.signTypedData).toHaveBeenCalledWith({
      account: ACCOUNT,
      domain: attestationDomain(84532, VAULT),
      types: ATTESTATION_TYPES,
      primaryType: "Attestation",
      message: ATTESTATION,
    });
  });
});

describe("built-in decision policies", () => {
  it("return stable reasons", async () => {
    await expect(new AcceptAllPolicy().decide({} as never)).resolves.toEqual({
      accept: true,
      reason: "mock policy (AcceptAll)",
    });
    await expect(new RejectAllPolicy().decide({} as never)).resolves.toEqual({
      accept: false,
      reason: "mock policy (RejectAll)",
    });
  });
});
