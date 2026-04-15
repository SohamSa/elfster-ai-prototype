import type { SeoBrief } from "@/lib/schemas/seo-discovery";

export type SeoBriefStatus = "draft" | "review" | "approved" | "published";

export type SeoBriefResponse = {
  ok: true;
  input: {
    query: string;
    locale: string;
    audienceHint?: string;
  };
  brief: SeoBrief;
  businessProblemsCovered: string[];
  /** True when the model still missed structural rules and the server filled gaps programmatically. */
  incompleteFallback?: boolean;
  /** Structural quality flags that were present before normalization (for transparency). */
  structuralWarnings?: string[];
};

export type SaveSeoBriefRequest = {
  query: string;
  locale: string;
  audienceHint?: string;
  brief: SeoBrief;
};

export type SavedSeoBriefItem = {
  id: string;
  query: string;
  locale: string;
  audienceHint?: string;
  status: SeoBriefStatus;
  owner?: string;
  reviewerNotes?: string;
  brief: SeoBrief;
  qualityFlags: string[];
  qualityScore: number;
  publishedAt?: string;
  createdAt: string;
  /** Traffic proxy (e.g. SERP impressions or on-site views). */
  impressions: number;
  /** Click-through proxy (e.g. result clicks). */
  clicks: number;
  /** Conversion proxy (e.g. add-to-list, signup intent). */
  conversions: number;
  /** Higher values surface first in the refresh queue (0 = normal). */
  refreshPriority: number;
  seasonalTag?: string;
  metricsUpdatedAt?: string;
  ctr: number | null;
  isLowPerformer: boolean;
  /** True when the brief should appear in the combined refresh / seasonal queue. */
  inRefreshQueue: boolean;
};

export type SavedSeoBriefListResponse = {
  ok: true;
  items: SavedSeoBriefItem[];
};

export type SeoInsightsResponse = {
  ok: true;
  lowPerformers: SavedSeoBriefItem[];
  refreshQueue: SavedSeoBriefItem[];
  thresholds: {
    minImpressions: number;
    maxCtr: number;
    stalePublishedDays: number;
  };
};

export type SaveSeoBriefResponse = {
  ok: true;
  item: SavedSeoBriefItem;
};
