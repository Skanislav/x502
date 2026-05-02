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

  it("returns submit when verifying but fact not ready", () => {
    // Post-claim, pre-fact: the user's done with the form, the coordinator
    // is mid-pipeline — submit is the most accurate label.
    expect(stepFromPipeline({ status: "verifying" })).toBe("submit");
  });

  it("returns commitment when idle (the user's still preparing)", () => {
    // Idle = pre-submission. The inline CommitmentForm lives in this step,
    // so the stepper highlights it as the active workspace.
    expect(stepFromPipeline({ status: "idle" })).toBe("commitment");
  });
});
