/** Utilities to compute points gained from available milliseconds with inflation (geometric series) */
export function computePointsFromMs(baseMs: number, inflation: number, availableMs: number) {
  if (availableMs <= 0) return { points: 0, leftoverMs: 0 };
  const r = 1 + inflation;
  if (inflation === 0) {
    const n = Math.floor(availableMs / baseMs);
    return { points: n, leftoverMs: availableMs - n * baseMs };
  }
  // Solve r^n <= 1 + availableMs*(r-1)/base
  const limit = 1 + (availableMs * (r - 1)) / baseMs;
  if (limit <= 1) return { points: 0, leftoverMs: availableMs };
  const n = Math.floor(Math.log(limit) / Math.log(r));
  // sum time for n points: base * (r^n - 1) / (r - 1)
  const sumTime = baseMs * (Math.pow(r, n) - 1) / (r - 1);
  const leftover = availableMs - sumTime;
  return { points: n, leftoverMs: leftover };
}

