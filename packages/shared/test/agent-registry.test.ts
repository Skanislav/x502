import { describe, expect, it, vi } from "vitest";

import { resolveAgentWallet } from "../src/agent-registry.js";

describe("resolveAgentWallet", () => {
  it("calls getAgentWallet on the registry contract and returns the address", async () => {
    const wallet = "0x2222222222222222222222222222222222222222" as const;
    const readContract = vi.fn(async () => wallet);
    const result = await resolveAgentWallet(
      {
        client: { readContract },
        address: "0x1111111111111111111111111111111111111111",
      },
      101n,
    );
    expect(result).toBe(wallet);
    expect(readContract).toHaveBeenCalledWith({
      address: "0x1111111111111111111111111111111111111111",
      abi: expect.anything(),
      functionName: "getAgentWallet",
      args: [101n],
    });
  });
});
