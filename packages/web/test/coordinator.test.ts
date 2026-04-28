import { afterEach, describe, expect, test, vi } from "vitest";
import { CoordinatorClient, type PostClaimRequest } from "../lib/coordinator";

describe("CoordinatorClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("postClaim returns success JSON and sends the expected request", async () => {
    const request: PostClaimRequest = {
      repoSlug: "owner/repo",
      externalId: "2",
      kind: "report",
      recipient: `0x${"11".repeat(20)}`,
      agentIdReveal: "101",
      saltReveal: `0x${"00".repeat(30)}beef`,
    };
    const response = {
      claimId: `0x${"22".repeat(32)}`,
      pollUrl: "/payout/1",
      status: "verifying",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(new CoordinatorClient("https://coord.test").postClaim(request)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith("https://coord.test/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  });

  test("postClaim throws the x402 error for 402 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("payment required", { status: 402 })));

    await expect(
      new CoordinatorClient("https://coord.test").postClaim({
        repoSlug: "owner/repo",
        externalId: "2",
        kind: "report",
        recipient: `0x${"11".repeat(20)}`,
      }),
    ).rejects.toThrow(
      "402 Payment Required — coordinator gated /claim with x402; you need an x402-fetch-wrapped client to settle the anti-spam fee.",
    );
  });

  test("postClaim includes status and response text for non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad claim", { status: 500 })));

    await expect(
      new CoordinatorClient("https://coord.test").postClaim({
        repoSlug: "owner/repo",
        externalId: "2",
        kind: "report",
        recipient: `0x${"11".repeat(20)}`,
      }),
    ).rejects.toThrow("coordinator returned 500: bad claim");
  });

  test("poll returns status and body from the payout endpoint", async () => {
    const body = {
      status: "ready",
      claimId: `0x${"33".repeat(32)}`,
      factReady: true,
      sigs: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(new CoordinatorClient("https://coord.test").poll(body.claimId)).resolves.toEqual({
      status: 202,
      body,
    });
    expect(fetchMock).toHaveBeenCalledWith(`https://coord.test/payout/${body.claimId}`);
  });
});
