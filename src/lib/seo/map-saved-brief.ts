import { seoBriefSchema } from "@/lib/schemas/seo-discovery";
import type { SavedSeoBriefItem, SeoBriefStatus } from "@/lib/types/seo-discovery";
import { computeCtr, inRefreshQueue, isLowPerformer } from "@/lib/seo/growth-metrics";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export const savedSeoBriefPublicSelect = {
  id: true,
  query: true,
  locale: true,
  audienceHint: true,
  status: true,
  owner: true,
  reviewerNotes: true,
  briefJson: true,
  qualityJson: true,
  publishedAt: true,
  impressions: true,
  clicks: true,
  conversions: true,
  refreshPriority: true,
  seasonalTag: true,
  metricsUpdatedAt: true,
  createdAt: true,
} as const;

export type SavedSeoBriefRow = {
  id: string;
  query: string;
  locale: string;
  audienceHint: string | null;
  status: SeoBriefStatus;
  owner: string | null;
  reviewerNotes: string | null;
  briefJson: unknown;
  qualityJson: unknown;
  publishedAt: Date | null;
  impressions: number;
  clicks: number;
  conversions: number;
  refreshPriority: number;
  seasonalTag: string | null;
  metricsUpdatedAt: Date | null;
  createdAt: Date;
};

export function mapSavedBriefRow(row: SavedSeoBriefRow): SavedSeoBriefItem | null {
  const parsed = seoBriefSchema.safeParse(row.briefJson);
  if (!parsed.success) return null;
  const quality =
    row.qualityJson && typeof row.qualityJson === "object"
      ? (row.qualityJson as { qualityFlags?: unknown; qualityScore?: unknown })
      : {};
  const qualityFlags = Array.isArray(quality.qualityFlags)
    ? quality.qualityFlags.filter((x): x is string => typeof x === "string")
    : [];
  const qualityScore = typeof quality.qualityScore === "number" ? quality.qualityScore : 0;
  const impressions = row.impressions;
  const clicks = row.clicks;
  const conversions = row.conversions;
  const ctr = computeCtr(impressions, clicks);
  const low = isLowPerformer(impressions, clicks);
  const publishedAtIso = row.publishedAt ? row.publishedAt.toISOString() : undefined;
  const seasonal = row.seasonalTag?.trim() || undefined;
  const priority = row.refreshPriority;
  return {
    id: row.id,
    query: row.query,
    locale: row.locale,
    audienceHint: row.audienceHint ?? undefined,
    status: row.status,
    owner: row.owner ?? undefined,
    reviewerNotes: row.reviewerNotes ?? undefined,
    brief: parsed.data,
    qualityFlags,
    qualityScore,
    publishedAt: publishedAtIso,
    createdAt: row.createdAt.toISOString(),
    impressions,
    clicks,
    conversions,
    refreshPriority: priority,
    seasonalTag: seasonal,
    metricsUpdatedAt: row.metricsUpdatedAt ? row.metricsUpdatedAt.toISOString() : undefined,
    ctr,
    isLowPerformer: low,
    inRefreshQueue: inRefreshQueue({
      refreshPriority: priority,
      seasonalTag: seasonal,
      isLowPerformer: low,
      publishedAt: publishedAtIso,
    }),
  };
}

/** Parse a saved brief object from JSON (client or API response). */
export function parseSavedBriefItemFromApi(x: unknown): SavedSeoBriefItem | null {
  if (!isRecord(x)) return null;
  const briefParsed = seoBriefSchema.safeParse(x.brief);
  if (!briefParsed.success) return null;
  if (typeof x.id !== "string" || typeof x.query !== "string" || typeof x.locale !== "string") return null;
  if (typeof x.createdAt !== "string") return null;
  const status = typeof x.status === "string" ? x.status : "draft";
  const allowed: SeoBriefStatus[] = ["draft", "review", "approved", "published"];
  if (!allowed.includes(status as SeoBriefStatus)) return null;

  const qualityFlags = Array.isArray(x.qualityFlags)
    ? x.qualityFlags.filter((f): f is string => typeof f === "string")
    : [];
  const qualityScore = typeof x.qualityScore === "number" ? x.qualityScore : 0;
  const impressions = typeof x.impressions === "number" && Number.isFinite(x.impressions) ? x.impressions : 0;
  const clicks = typeof x.clicks === "number" && Number.isFinite(x.clicks) ? x.clicks : 0;
  const conversions = typeof x.conversions === "number" && Number.isFinite(x.conversions) ? x.conversions : 0;
  const refreshPriority =
    typeof x.refreshPriority === "number" && Number.isFinite(x.refreshPriority) ? x.refreshPriority : 0;
  const seasonalTag =
    typeof x.seasonalTag === "string" && x.seasonalTag.trim().length > 0 ? x.seasonalTag.trim() : undefined;
  const metricsUpdatedAt = typeof x.metricsUpdatedAt === "string" ? x.metricsUpdatedAt : undefined;
  const publishedAt = typeof x.publishedAt === "string" ? x.publishedAt : undefined;
  const owner = typeof x.owner === "string" ? x.owner : undefined;
  const reviewerNotes = typeof x.reviewerNotes === "string" ? x.reviewerNotes : undefined;
  const audienceHint = typeof x.audienceHint === "string" ? x.audienceHint : undefined;

  const ctr = computeCtr(impressions, clicks);
  const low = isLowPerformer(impressions, clicks);
  return {
    id: x.id,
    query: x.query,
    locale: x.locale,
    audienceHint,
    status: status as SeoBriefStatus,
    owner,
    reviewerNotes,
    brief: briefParsed.data,
    qualityFlags,
    qualityScore,
    publishedAt,
    createdAt: x.createdAt,
    impressions,
    clicks,
    conversions,
    refreshPriority,
    seasonalTag,
    metricsUpdatedAt,
    ctr,
    isLowPerformer: low,
    inRefreshQueue: inRefreshQueue({
      refreshPriority,
      seasonalTag,
      isLowPerformer: low,
      publishedAt,
    }),
  };
}
