import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mapSavedBriefRow, savedSeoBriefPublicSelect } from "@/lib/seo/map-saved-brief";

const bodySchema = z
  .object({
    impressionsDelta: z.number().int().min(0).max(10_000).optional(),
    clicksDelta: z.number().int().min(0).max(10_000).optional(),
    conversionsDelta: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(
    (d) =>
      (d.impressionsDelta !== undefined && d.impressionsDelta > 0) ||
      (d.clicksDelta !== undefined && d.clicksDelta > 0) ||
      (d.conversionsDelta !== undefined && d.conversionsDelta > 0),
    { message: "Provide at least one positive delta." },
  );

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const payload = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid metrics body." }, { status: 400 });
  }

  const incI = parsed.data.impressionsDelta ?? 0;
  const incC = parsed.data.clicksDelta ?? 0;
  const incV = parsed.data.conversionsDelta ?? 0;

  try {
    const row = await prisma.savedSeoBrief.update({
      where: { id },
      data: {
        impressions: { increment: incI },
        clicks: { increment: incC },
        conversions: { increment: incV },
        metricsUpdatedAt: new Date(),
      },
      select: savedSeoBriefPublicSelect,
    });
    const item = mapSavedBriefRow(row);
    if (!item) {
      return NextResponse.json({ error: "Brief is unreadable after update." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ error: "Saved brief not found." }, { status: 404 });
  }
}
