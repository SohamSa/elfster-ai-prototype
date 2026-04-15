import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LOW_PERFORMER_MAX_CTR,
  LOW_PERFORMER_MIN_IMPRESSIONS,
  STALE_PUBLISHED_DAYS,
} from "@/lib/seo/growth-metrics";
import { mapSavedBriefRow, savedSeoBriefPublicSelect } from "@/lib/seo/map-saved-brief";
import type { SeoInsightsResponse } from "@/lib/types/seo-discovery";

export async function GET() {
  const rows = await prisma.savedSeoBrief.findMany({
    orderBy: [{ refreshPriority: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: savedSeoBriefPublicSelect,
  });

  const items = rows.map(mapSavedBriefRow).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const lowPerformers = items.filter((i) => i.isLowPerformer);
  const refreshQueue = items
    .filter((i) => i.inRefreshQueue)
    .sort((a, b) => {
      if (b.refreshPriority !== a.refreshPriority) return b.refreshPriority - a.refreshPriority;
      if (a.isLowPerformer !== b.isLowPerformer) return a.isLowPerformer ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const body: SeoInsightsResponse = {
    ok: true,
    lowPerformers,
    refreshQueue,
    thresholds: {
      minImpressions: LOW_PERFORMER_MIN_IMPRESSIONS,
      maxCtr: LOW_PERFORMER_MAX_CTR,
      stalePublishedDays: STALE_PUBLISHED_DAYS,
    },
  };
  return NextResponse.json(body);
}
