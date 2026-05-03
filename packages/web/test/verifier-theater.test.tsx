import { describe, expect, it } from "vitest";

import { agentColumnFromSpec } from "../components/VerifierTheater";

describe("agentColumnFromSpec", () => {
  it("uses the current runtime verifier address", () => {
    const column = agentColumnFromSpec(
      {
        agentId: "101",
        address: "0xf571AcEe958B86FDD2be8A74e1CC041b58c9b48D",
      },
      {},
    );

    expect(column).toEqual({
      agentId: "101",
      attesterAddress: "0xf571AcEe958B86FDD2be8A74e1CC041b58c9b48D",
      status: "idle",
    });
  });

  it("preserves observed attestation state for unchanged verifier addresses", () => {
    const column = agentColumnFromSpec(
      {
        agentId: "101",
        address: "0xf571AcEe958B86FDD2be8A74e1CC041b58c9b48D",
      },
      {
        "0xf571acee958b86fdd2be8a74e1cc041b58c9b48d": {
          status: "attested",
          uid: "0xabc",
        },
      },
    );

    expect(column).toEqual({
      agentId: "101",
      attesterAddress: "0xf571AcEe958B86FDD2be8A74e1CC041b58c9b48D",
      status: "attested",
      uid: "0xabc",
    });
  });
});
