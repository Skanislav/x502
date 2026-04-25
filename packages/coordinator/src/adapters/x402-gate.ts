import type { Hono } from "hono";
import type { Address } from "viem";
import { type Network, paymentMiddleware } from "x402-hono";

import type { IPaymentGate } from "../providers.js";

export interface X402PaymentGateOptions {
  /// USDC recipient for the anti-spam fee. Typically the coordinator's hot
  /// wallet — that USDC then funds outbound x402 calls to verifier agents.
  payTo: Address;
  /// Routes to gate. Path → price (e.g. `{ "/claim": { price: "$0.01", network: "base-sepolia" } }`).
  routes: Record<string, { price: string; network: Network; description?: string }>;
  /// Optional facilitator override. Defaults to https://x402.org/facilitator on testnets.
  facilitatorUrl?: string;
}

/// Real x402 anti-spam gate. Returns 402 with payment requirements until the
/// caller settles via the facilitator (default: https://x402.org/facilitator
/// on testnets, free up to 1k settled payments/month).
export class X402PaymentGate implements IPaymentGate {
  constructor(private readonly opts: X402PaymentGateOptions) {}

  apply(app: Hono): void {
    const routes: Parameters<typeof paymentMiddleware>[1] = {};
    for (const [path, cfg] of Object.entries(this.opts.routes)) {
      routes[path] = {
        price: cfg.price,
        network: cfg.network,
        config: cfg.description ? { description: cfg.description } : undefined,
      };
    }
    const facilitator = this.opts.facilitatorUrl
      ? { url: this.opts.facilitatorUrl as `${string}://${string}` }
      : undefined;
    app.use(paymentMiddleware(this.opts.payTo, routes, facilitator));
  }
}
