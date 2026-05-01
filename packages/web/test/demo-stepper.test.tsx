import { describe, expect, it } from "vitest";

import { stepFromPipeline } from "../components/DemoStepper";

describe("stepFromPipeline", () => {
  it("returns done when paid", () => {
    expect(stepFromPipeline({ status: "paid" })).toBe("done");
  });

  it("returns payout when ready", () => {
    expect(stepFromPipeline({ status: "ready" })).toBe("payout");
  });

  it("returns payout when failed", () => {
    expect(stepFromPipeline({ status: "failed" })).toBe("payout");
  });

  it("advances to verifiers when at least one signature has landed", () => {
    expect(stepFromPipeline({ status: "verifying", factReady: true, sigs: 1 })).toBe("verifiers");
  });

  it("advances to verifiers when fact is ready even without signatures", () => {
    expect(stepFromPipeline({ status: "verifying", factReady: true, sigs: 0 })).toBe("verifiers");
  });

  it("stays at fact when verifying but fact not ready", () => {
    expect(stepFromPipeline({ status: "verifying" })).toBe("fact");
  });

  it("returns submit when idle", () => {
    expect(stepFromPipeline({ status: "idle" })).toBe("submit");
  });
});
