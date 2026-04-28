import { recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
  ATTESTATION_TYPES,
  Kind,
  attestationDomain,
  attestationTypedData,
  deriveClaimId,
  repoIdFromSlug,
} from "../src/index.js";

const VAULT = "0x1111111111111111111111111111111111111111" as const;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as const;
const FACT_HASH = `0x${"ab".repeat(32)}` as const;

describe("attestation typed data", () => {
  it("builds the expected domain and message", () => {
    const claimId = deriveClaimId(repoIdFromSlug("x502-protocol/demo"), 42n, Kind.Fix);
    const att = { claimId, recipient: RECIPIENT, deadline: 123n, factHash: FACT_HASH };
    const td = attestationTypedData(84532, VAULT, att);
    expect(td.domain).toEqual(attestationDomain(84532, VAULT));
    expect(td.types).toBe(ATTESTATION_TYPES);
    expect(td.primaryType).toBe("Attestation");
    expect(td.message).toBe(att);
  });

  it("recovers the signer from the typed data", async () => {
    const account = privateKeyToAccount(
      "0x59c6995e998f97a5a004497e5da2c071b89c3e064a3fbd821d5f9b988e5b0c0d",
    );
    const claimId = deriveClaimId(repoIdFromSlug("x502-protocol/demo"), 42n, Kind.Fix);
    const att = { claimId, recipient: RECIPIENT, deadline: 123n, factHash: FACT_HASH };
    const td = attestationTypedData(84532, VAULT, att);
    const signature = await account.signTypedData(td);
    const recovered = await recoverTypedDataAddress({
      domain: { name: "x502", version: "1", chainId: 84532, verifyingContract: VAULT },
      types: {
        Attestation: [
          { name: "claimId", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "factHash", type: "bytes32" },
        ],
      },
      primaryType: "Attestation",
      message: att,
      signature,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});
