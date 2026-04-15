import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { seoBriefSchema } from "@/lib/schemas/seo-discovery";
import { evaluateBrandGuardrails } from "@/lib/seo/brand-guardrails";
import { evaluateQuality, qualityViolationsForStatus } from "@/lib/seo/brief-quality";
import {
  mapSavedBriefRow,
  savedSeoBriefPublicSelect,
  type SavedSeoBriefRow,
} from "@/lib/seo/map-saved-brief";
import type {
  SavedSeoBriefListResponse,
  SavedSeoBriefItem,
  SeoBriefStatus,
  SaveSeoBriefResponse,
} from "@/lib/types/seo-discovery";

const saveSchema = z.object({
  query: z.string().min(3).max(300),
  locale: z.string().min(2).max(32),
  audienceHint: z.string().max(120).optional(),
  owner: z.string().max(80).optional(),
  brief: seoBriefSchema,
});

const statusSchema = z.enum(["draft", "review", "approved", "published"]);
const patchSchema = z.object({
  id: z.string().min(1),
  status: statusSchema.optional(),
  owner: z.string().max(80).optional(),
  reviewerNotes: z.string().max(1500).optional(),
  refreshPriority: z.number().int().min(0).max(3).optional(),
  seasonalTag: z.union([z.string().max(40), z.null()]).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();
  const where = {
    ...(status && statusSchema.safeParse(status).success ? { status: status as SeoBriefStatus } : {}),
    ...(q ? { query: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const rows = await prisma.savedSeoBrief.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 30,
    select: savedSeoBriefPublicSelect,
  });

  const items = rows.map(mapSavedBriefRow).filter((x): x is SavedSeoBriefItem => Boolean(x));
  const body: SavedSeoBriefListResponse = { ok: true, items };
  return NextResponse.json(body);
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid JSON body for saving brief." }, { status: 400 });
  }

  const quality = evaluateQuality(parsed.data.brief);
  const created = await prisma.savedSeoBrief.create({
    data: {
      query: parsed.data.query,
      locale: parsed.data.locale,
      audienceHint: parsed.data.audienceHint,
      owner: parsed.data.owner,
      briefJson: parsed.data.brief,
      qualityJson: quality,
    },
    select: savedSeoBriefPublicSelect,
  });

  const item = mapSavedBriefRow(created);
  if (!item) {
    return NextResponse.json({ error: "Saved brief could not be read back." }, { status: 500 });
  }

  const body: SaveSeoBriefResponse = { ok: true, item };
  return NextResponse.json(body, { status: 201 });
}

export async function PATCH(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid JSON body for update." }, { status: 400 });
  }

  const existing = await prisma.savedSeoBrief.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      status: true,
      briefJson: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Saved brief not found." }, { status: 404 });
  }

  const requestedStatus = parsed.data.status;

  const isPromotionToReviewed =
    requestedStatus !== undefined &&
    requestedStatus !== existing.status &&
    (requestedStatus === "approved" || requestedStatus === "published");

  const briefParsed = seoBriefSchema.safeParse(existing.briefJson);
  if (!briefParsed.success) {
    return NextResponse.json({ error: "Stored brief is invalid; cannot update." }, { status: 500 });
  }

  const quality = evaluateQuality(briefParsed.data);

  if (isPromotionToReviewed) {
    const brand = evaluateBrandGuardrails(briefParsed.data);
    const violations = [...brand.violations, ...qualityViolationsForStatus(requestedStatus, quality.qualityFlags)];
    if (violations.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot approve or publish until brand and quality checks pass.",
          violations,
        },
        { status: 422 },
      );
    }
  }

  const seasonalData =
    parsed.data.seasonalTag !== undefined
      ? {
          seasonalTag:
            parsed.data.seasonalTag === null || parsed.data.seasonalTag.trim() === ""
              ? null
              : parsed.data.seasonalTag.trim(),
        }
      : {};

  let updated: SavedSeoBriefRow;
  try {
    updated = await prisma.savedSeoBrief.update({
      where: { id: parsed.data.id },
      data: {
        ...(requestedStatus !== undefined ? { status: requestedStatus } : {}),
        ...(parsed.data.owner !== undefined ? { owner: parsed.data.owner } : {}),
        ...(parsed.data.reviewerNotes !== undefined ? { reviewerNotes: parsed.data.reviewerNotes } : {}),
        ...(parsed.data.refreshPriority !== undefined ? { refreshPriority: parsed.data.refreshPriority } : {}),
        ...seasonalData,
        ...(requestedStatus === "published" && existing.status !== "published"
          ? { publishedAt: new Date() }
          : {}),
        qualityJson: quality,
      },
      select: savedSeoBriefPublicSelect,
    });
  } catch {
    return NextResponse.json({ error: "Saved brief not found." }, { status: 404 });
  }

  const item = mapSavedBriefRow(updated);
  if (!item) {
    return NextResponse.json({ error: "Updated brief could not be read back." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item });
}
