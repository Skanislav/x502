import { decodeAbiParameters } from "viem";
import { describe, expect, it, vi } from "vitest";

import { ATTESTATION_TYPES, attestationDomain } from "@x502/shared";

import { AcceptAllPolicy, RejectAllPolicy } from "../src/decide.js";
import { ERC6492_MAGIC, signAttestation, signerAddress, wrap6492 } from "../src/sign.js";

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

describe("ERC-6492 smart-wallet wrap", () => {
  const FACTORY = "0x4444444444444444444444444444444444444444" as const;
  const SMART_ADDR = "0x5555555555555555555555555555555555555555" as const;
  const FACTORY_CALL = "0xdeadbeef" as const;
  const INNER_SIG = `0x${"aa".repeat(65)}` as const;

  it("wrap6492 appends the magic suffix and ABI-encodes (factory, calldata, innerSig)", () => {
    const wrapped = wrap6492(INNER_SIG, {
      address: SMART_ADDR,
      factory: FACTORY,
      factoryCalldata: FACTORY_CALL,
    });
    // Tail must be the magic constant.
    expect(wrapped.toLowerCase().endsWith(ERC6492_MAGIC.slice(2))).toBe(true);
    // Body decodes to the inputs we provided.
    const body = `0x${wrapped.slice(2, wrapped.length - 64)}` as `0x${string}`;
    const [factory, calldata, inner] = decodeAbiParameters(
      [{ type: "address" }, { type: "bytes" }, { type: "bytes" }],
      body,
    );
    expect(factory.toLowerCase()).toBe(FACTORY.toLowerCase());
    expect(calldata).toBe(FACTORY_CALL);
    expect(inner).toBe(INNER_SIG);
  });

  it("signAttestation wraps the inner sig with 6492 when smartWallet is configured", async () => {
    const wallet = { signTypedData: vi.fn(async () => INNER_SIG) };
    const signed = await signAttestation(
      {
        agentId: 103n,
        vault: VAULT,
        chainId: 84532,
        account: ACCOUNT as never,
        wallet: wallet as never,
        smartWallet: {
          address: SMART_ADDR,
          factory: FACTORY,
          factoryCalldata: FACTORY_CALL,
        },
      },
      ATTESTATION,
    );

    expect(signed.signature).not.toBe(INNER_SIG);
    expect(signed.signature.toLowerCase().endsWith(ERC6492_MAGIC.slice(2))).toBe(true);
  });

  it("signAttestation returns the bare inner sig when smartWallet is absent", async () => {
    const wallet = { signTypedData: vi.fn(async () => INNER_SIG) };
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
    expect(signed.signature).toBe(INNER_SIG);
  });

  it("signerAddress reports the smart-wallet address when configured, else the EOA", () => {
    expect(
      signerAddress({
        agentId: 1n,
        vault: VAULT,
        chainId: 84532,
        account: ACCOUNT as never,
        wallet: {} as never,
      }),
    ).toBe(ACCOUNT.address);

    expect(
      signerAddress({
        agentId: 1n,
        vault: VAULT,
        chainId: 84532,
        account: ACCOUNT as never,
        wallet: {} as never,
        smartWallet: { address: SMART_ADDR, factory: FACTORY, factoryCalldata: FACTORY_CALL },
      }),
    ).toBe(SMART_ADDR);
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
