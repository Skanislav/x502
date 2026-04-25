/**
 * Split an integer total evenly across `n` buckets.
 *
 * Returns an array of length `n` whose elements sum to `total`. Any leftover
 * units after integer division are distributed one-per-bucket from the front.
 */
export function splitEvenly(total: number, n: number): number[] {
  if (!Number.isInteger(total) || !Number.isInteger(n)) {
    throw new TypeError("splitEvenly: total and n must be integers");
  }
  if (n <= 0) throw new RangeError("splitEvenly: n must be positive");
  if (total < 0) throw new RangeError("splitEvenly: total must be >= 0");

  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
