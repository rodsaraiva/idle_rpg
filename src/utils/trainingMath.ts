/**
 * Logarithmic inflation: time per point = base * (1 + k * ln(count + 1))
 * This grows much slower than exponential — point 50 takes ~3x base, point 100 takes ~3.3x base.
 */
export function computePointsFromMs(baseMs: number, inflationK: number, availableMs: number) {
  if (availableMs <= 0) return { points: 0, leftoverMs: 0 };

  if (inflationK === 0) {
    const n = Math.floor(availableMs / baseMs);
    return { points: n, leftoverMs: availableMs - n * baseMs };
  }

  let remaining = availableMs;
  let points = 0;

  // Iteratively compute points (logarithmic series doesn't have a clean closed form)
  while (remaining > 0) {
    const timeForNextPoint = baseMs * (1 + inflationK * Math.log(points + 1));
    if (remaining < timeForNextPoint) break;
    remaining -= timeForNextPoint;
    points++;
    // Safety cap to avoid infinite loops
    if (points > 10000) break;
  }

  return { points, leftoverMs: remaining };
}

