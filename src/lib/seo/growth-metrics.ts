/** Minimum impressions before CTR is considered meaningful for low-performer detection. */
export const LOW_PERFORMER_MIN_IMPRESSIONS = 25;
/** CTR below this (with enough impressions) counts as a low performer (prototype tuning). */
export const LOW_PERFORMER_MAX_CTR = 0.025;
/** Published briefs older than this (days) surface in the seasonal / refresh queue. */
export const STALE_PUBLISHED_DAYS = 75;

export function computeCtr(impressions: number, clicks: number): number | null {
  if (impressions <= 0) return null;
  return clicks / impressions;
}

export function isLowPerformer(impressions: number, clicks: number): boolean {
  if (impressions < LOW_PERFORMER_MIN_IMPRESSIONS) return false;
  const ctr = computeCtr(impressions, clicks);
  return ctr !== null && ctr < LOW_PERFORMER_MAX_CTR;
}

export function isStalePublished(publishedAtIso: string | undefined, staleDays: number): boolean {
  if (!publishedAtIso) return false;
  const t = Date.parse(publishedAtIso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > staleDays * 86400000;
}

export function inRefreshQueue(input: {
  refreshPriority: number;
  seasonalTag?: string;
  isLowPerformer: boolean;
  publishedAt?: string;
}): boolean {
  if (input.refreshPriority > 0) return true;
  if (input.seasonalTag && input.seasonalTag.trim().length > 0) return true;
  if (input.isLowPerformer) return true;
  if (isStalePublished(input.publishedAt, STALE_PUBLISHED_DAYS)) return true;
  return false;
}
