/** Wilson score interval for binomial proportion (95% default). */
export function wilson95(successes: number, n: number, z = 1.959964): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const phat = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = phat + (z * z) / (2 * n);
  const adj = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n);
  return {
    low: Math.max(0, (centre - adj) / denom),
    high: Math.min(1, (centre + adj) / denom),
  };
}

export function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stdSample(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = nums.reduce((s, x) => s + (x - m) * (x - m), 0) / (nums.length - 1);
  return Math.sqrt(v);
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * McNemar mid-p style paired test on binary outcomes (same cases, two models).
 * Contingency: b = A pass & B fail, c = A fail & B pass.
 */
export function mcnemarPaired(
  okA: boolean[],
  okB: boolean[],
): { b: number; c: number; chi2: number | null; pApprox: number | null; note: string } {
  if (okA.length !== okB.length) {
    return { b: 0, c: 0, chi2: null, pApprox: null, note: "length_mismatch" };
  }
  let b = 0;
  let c = 0;
  for (let i = 0; i < okA.length; i++) {
    if (okA[i] && !okB[i]) b += 1;
    if (!okA[i] && okB[i]) c += 1;
  }
  const discord = b + c;
  if (discord === 0) {
    return { b, c, chi2: 0, pApprox: 1, note: "no_discordant_pairs" };
  }
  const chi2 = (Math.abs(b - c) - 1) ** 2 / discord;
  const pApprox = chi2 >= 3.841 ? 0.05 : chi2 >= 2.706 ? 0.1 : 1;
  return { b, c, chi2, pApprox, note: "yates_mcnemar_chi1df" };
}

export type FacetAgg = { passed: number; total: number; sumScore: number; sumWeighted: number };

export function emptyFacetAgg(): FacetAgg {
  return { passed: 0, total: 0, sumScore: 0, sumWeighted: 0 };
}

export function bumpFacet(map: Record<string, FacetAgg>, key: string, ok: boolean, score: number, w: number) {
  if (!map[key]) map[key] = emptyFacetAgg();
  const cell = map[key]!;
  cell.total += 1;
  if (ok) cell.passed += 1;
  cell.sumScore += score;
  cell.sumWeighted += w * score;
}
