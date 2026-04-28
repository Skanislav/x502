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

  it("rejects non-integer inputs", () => {
    expect(() => splitEvenly(10.5, 3)).toThrow(TypeError);
    expect(() => splitEvenly(10, 3.5)).toThrow(TypeError);
  });

  it("preserves the remainder when total isn't divisible by n", () => {
    expect(splitEvenly(10, 3)).toEqual([4, 3, 3]);
    expect(splitEvenly(10, 3).reduce((a, b) => a + b)).toBe(10);
  });

  it("hands out one extra to the first `total % n` buckets", () => {
    expect(splitEvenly(7, 4)).toEqual([2, 2, 2, 1]);
  });

  it("returns zero-filled when total is 0", () => {
    expect(splitEvenly(0, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it("keeps the sum when there are more buckets than units", () => {
    expect(splitEvenly(2, 5)).toEqual([1, 1, 0, 0, 0]);
  });
});
