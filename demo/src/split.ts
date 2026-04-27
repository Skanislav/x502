/**
 * Split an integer total evenly across `n` buckets.
 *
 * Returns an array of length `n` whose elements sum to `total`.
 * Used by the tip-pool router to divide micropayments without leaving wei
 * behind — every input cent must land in exactly one output bucket.
 */
export function splitEvenly(total: number, n: number): number[] {
  if (!Number.isInteger(total) || !Number.isInteger(n)) {
    throw new TypeError("splitEvenly: total and n must be integers");
  }
  if (n <= 0) throw new RangeError("splitEvenly: n must be positive");
  if (total < 0) throw new RangeError("splitEvenly: total must be >= 0");

  // BUG (planted for x502 demo): when `total` is not divisible by `n`,
  // integer division loses the remainder and the returned slots no longer
  // sum to `total`. Reporter's claim points at this.
  const each = Math.floor(total / n);
  return new Array(n).fill(each);
}
