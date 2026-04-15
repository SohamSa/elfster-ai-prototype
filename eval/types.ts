export type CaseMeta = {
  /** e.g. consumer, b2b, seasonal */
  segment?: string;
  difficulty?: "easy" | "medium" | "hard";
  /** e.g. commercial_longtail, mixed_intent */
  intentSurface?: string;
  tags?: string[];
  localeRegion?: string;
  /** Multiplies contribution to aggregate scores (default 1). */
  weight?: number;
};

export type SuggestCase = {
  id: string;
  type: "suggest";
  query: string;
  includeSeo?: boolean;
  meta?: CaseMeta;
  expect: {
    budgetMaxCents?: number;
    recipientContains?: string;
    minResults?: number;
    /** 0-1: fraction of query tokens (len>=3) that must appear in gift titles/descriptions. */
    minLexicalScore?: number;
  };
};

export type SeoCase = {
  id: string;
  type: "seo";
  query: string;
  locale?: string;
  audienceHint?: string;
  meta?: CaseMeta;
  expect: {
    titleMaxLen?: number;
    metaMinLen?: number;
    metaMaxLen?: number;
    minSections?: number;
    minFaqs?: number;
    minRelatedQueries?: number;
    minInternalAnchors?: number;
    minIntroLen?: number;
    minConversionNudges?: number;
    minFreshnessNotes?: number;
    duplicateRiskNotHigh?: boolean;
    /** 0-1 alignment of query tokens into title+meta+h1+intro. */
    minLexicalScore?: number;
  };
};

export type EvalCase = SuggestCase | SeoCase;

export type CaseResult = {
  id: string;
  type: "suggest" | "seo";
  ok: boolean;
  score: number;
  weightedScore: number;
  caseWeight: number;
  latencyMs: number;
  checks: string[];
  meta?: CaseMeta;
  facets: Record<string, string>;
  error?: string;
};

export type VariantReport = {
  model: string;
  total: number;
  passed: number;
  passRate: number;
  avgScore: number;
  weightedAvgScore: number;
  avgLatencyMs: number;
  medianLatencyMs: number;
  latencyStdMs: number;
  wilson95PassRate: { low: number; high: number };
  results: CaseResult[];
};
