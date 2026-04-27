import type { Address, Hex } from "viem";
import type { KindName } from "@x502/shared";

export interface PostClaimRequest {
  repoSlug: string;
  externalId: string;
  kind: KindName;
  recipient: Address;
  agentIdReveal?: string;
  saltReveal?: Hex;
}

export interface PostClaimResponse {
  claimId: Hex;
  pollUrl: string;
  status: "verifying" | "ready" | "paid" | "failed";
}

export type PollResponse =
  | { status: "verifying" | "ready"; claimId: Hex; factReady: boolean; sigs: number }
  | { status: "paid"; claimId: Hex; recipient: Address; txHash: Hex }
  | { status: "failed"; claimId: Hex; error: string };

export class CoordinatorClient {
  constructor(private readonly baseUrl: string) {}

  async postClaim(req: PostClaimRequest): Promise<PostClaimResponse> {
    const r = await fetch(`${this.baseUrl}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (r.status === 402) {
      throw new Error(
        "402 Payment Required — coordinator gated /claim with x402; you need an x402-fetch-wrapped client to settle the anti-spam fee.",
      );
    }
    if (!r.ok) throw new Error(`coordinator returned ${r.status}: ${await r.text()}`);
    return (await r.json()) as PostClaimResponse;
  }

  async poll(claimId: Hex): Promise<{ status: number; body: PollResponse }> {
    const r = await fetch(`${this.baseUrl}/payout/${claimId}`);
    const body = (await r.json()) as PollResponse;
    return { status: r.status, body };
  }
}
