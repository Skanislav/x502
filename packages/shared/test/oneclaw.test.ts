import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { localOneClaw, pickOneClawFromEnv, remoteOneClawStub } from "../src/oneclaw/client.js";

describe("localOneClaw", () => {
  it("resolveScope reads the private key from the env-var named by scopeId", async () => {
    const pk = generatePrivateKey();
    const expected = privateKeyToAccount(pk).address;
    const client = localOneClaw({ MY_AGENT_KEY: pk });
    const scope = await client.resolveScope("MY_AGENT_KEY");
    expect(scope.address.toLowerCase()).toBe(expected.toLowerCase());
    expect(scope.kind).toBe("eoa");
    expect(scope.scopeId).toBe("MY_AGENT_KEY");
  });

  it("signTypedData round-trips through viem when the env binding exists", async () => {
    const pk = generatePrivateKey();
    const client = localOneClaw({ MY_AGENT_KEY: pk });
    const sig = await client.signTypedData("MY_AGENT_KEY", {
      domain: { name: "x502", version: "1", chainId: 31337 },
      types: { Claim: [{ name: "agentId", type: "uint256" }] },
      primaryType: "Claim",
      message: { agentId: 101n },
    });
    expect(sig).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  it("throws with a helpful message when the scope env var is missing", async () => {
    const client = localOneClaw({});
    await expect(client.resolveScope("MISSING_KEY")).rejects.toThrow(/MISSING_KEY/);
  });

  it("getSecret reads arbitrary env keys", async () => {
    const client = localOneClaw({ ANTHROPIC_API_KEY: "sk-test", GITHUB_TOKEN: "ghp_test" });
    expect(await client.getSecret("ANTHROPIC_API_KEY")).toBe("sk-test");
    expect(await client.getSecret("GITHUB_TOKEN")).toBe("ghp_test");
    expect(await client.getSecret("UNSET_KEY")).toBeUndefined();
  });
});

describe("remoteOneClawStub", () => {
  it("rejects every operation with a 'not yet wired' error pointing at the seam", async () => {
    const client = remoteOneClawStub({ mode: "remote", endpoint: "https://1claw.xyz" });
    for (const op of [
      () => client.resolveScope("scope"),
      () =>
        client.signTypedData("scope", {
          domain: {},
          types: { X: [{ name: "x", type: "uint256" }] },
          primaryType: "X",
          message: { x: 1n },
        }),
      () => client.signMessage("scope", { message: "hi" }),
      () => client.getSecret("ANTHROPIC_API_KEY"),
    ]) {
      await expect(op()).rejects.toThrow(/not yet wired/);
    }
  });
});

describe("pickOneClawFromEnv", () => {
  it("defaults to local mode when ONECLAW_MODE is unset", async () => {
    const pk = generatePrivateKey();
    const client = pickOneClawFromEnv({ TEST_KEY: pk });
    const scope = await client.resolveScope("TEST_KEY");
    expect(scope.kind).toBe("eoa");
  });

  it("returns the remote stub when ONECLAW_MODE=remote", async () => {
    const client = pickOneClawFromEnv({ ONECLAW_MODE: "remote" });
    await expect(client.resolveScope("scope")).rejects.toThrow(/not yet wired/);
  });

  it("rejects an unknown ONECLAW_MODE", () => {
    expect(() => pickOneClawFromEnv({ ONECLAW_MODE: "wat" })).toThrow(/Unknown ONECLAW_MODE/);
  });
});
