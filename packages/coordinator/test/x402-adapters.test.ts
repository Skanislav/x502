import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, Address, WalletClient } from "viem";

vi.mock("x402-fetch", () => ({ wrapFetchWithPayment: vi.fn((f) => f) }));
vi.mock("x402-hono", () => ({ paymentMiddleware: vi.fn(() => async (_c, next) => next()) }));

import { wrapFetchWithPayment } from "x402-fetch";
import { paymentMiddleware } from "x402-hono";

import { buildX402Fetch } from "../src/adapters/x402-fetch.js";
import { X402PaymentGate } from "../src/adapters/x402-gate.js";

describe("buildX402Fetch", () => {
  beforeEach(() => {
    vi.mocked(wrapFetchWithPayment).mockClear();
  });

  it("delegates to wrapFetchWithPayment with global fetch and wallet client", () => {
    const walletClient = {
      account: { address: "0x1111111111111111111111111111111111111111" },
    } as WalletClient & { account: Account };

    const wrapped = buildX402Fetch(walletClient);

    expect(wrapFetchWithPayment).toHaveBeenCalledWith(globalThis.fetch, walletClient);
    expect(wrapped).toBe(globalThis.fetch);
  });
});

describe("X402PaymentGate", () => {
  beforeEach(() => {
    vi.mocked(paymentMiddleware).mockClear();
  });

  it("applies payment middleware with route config and facilitator URL", () => {
    const app = new Hono();
    const payTo = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as Address;
    const gate = new X402PaymentGate({
      payTo,
      routes: {
        "/claim": {
          price: "$0.01",
          network: "base-sepolia",
          description: "Coordinator claim anti-spam fee",
        },
      },
      facilitatorUrl: "https://facilitator.example",
    });

    gate.apply(app);

    expect(paymentMiddleware).toHaveBeenCalledWith(
      payTo,
      {
        "/claim": {
          price: "$0.01",
          network: "base-sepolia",
          config: { description: "Coordinator claim anti-spam fee" },
        },
      },
      { url: "https://facilitator.example" },
    );
  });

  it("omits optional description config and facilitator when absent", () => {
    const app = new Hono();
    const payTo = "0x24582544C98a86eE59687c4D5B55D78f4FffA666" as Address;
    const gate = new X402PaymentGate({
      payTo,
      routes: {
        "/claim": {
          price: "$0.01",
          network: "base-sepolia",
        },
      },
    });

    gate.apply(app);

    expect(paymentMiddleware).toHaveBeenCalledWith(
      payTo,
      {
        "/claim": {
          price: "$0.01",
          network: "base-sepolia",
          config: undefined,
        },
      },
      undefined,
    );
  });
});
