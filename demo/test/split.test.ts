import { describe, expect, it } from "vitest";
import { splitEvenly } from "../src/split.js";

describe("splitEvenly", () => {
  it("splits a perfectly-divisible total", () => {
    expect(splitEvenly(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it("rejects non-positive n", () => {
    expect(() => splitEvenly(10, 0)).toThrow(RangeError);
    expect(() => splitEvenly(10, -1)).toThrow(RangeError);
  });

  it("rejects negative totals", () => {
    expect(() => splitEvenly(-1, 3)).toThrow(RangeError);
  });

  // GAP (planted for x502 demo): no test for the remainder case where
  // total % n != 0. The bug in src/split.ts only surfaces here; the
  // `docs_tests` bounty rewards the PR that adds this coverage.
  // it.todo("preserves the remainder when total isn't divisible by n");
});
