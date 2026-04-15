import { generateObject } from "ai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuggestionModel } from "@/lib/ai/model";
import {
  looksLikeRealOpenAiKey,
  openAiFriendlyError,
  parseAndValidateBody,
} from "@/lib/ai/guards";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { wishSchema, type ParsedWish } from "@/lib/schemas/wish";
import type { Gift } from "@prisma/client";

const bodySchema = z.object({
  query: z.string().min(1).max(2000),
  includeSeo: z.boolean().optional(),
  modelOverride: z.string().min(3).max(80).optional(),
});

const explanationsSchema = z.object({
  items: z.array(
    z.object({
      giftId: z.string(),
      explanation: z.string(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
    }),
  ),
});

function rankGifts(wish: ParsedWish, gifts: Gift[]): Gift[] {
  const interests = new Set(wish.interests.map((t) => t.toLowerCase()));
  const recip = wish.recipient?.toLowerCase() ?? "";
  return [...gifts]
    .map((g) => {
      let score = 0;
      for (const t of g.tags) {
        if (interests.has(t.toLowerCase())) score += 2;
      }
      if (recip && g.audience?.toLowerCase().includes(recip)) score += 3;
      if (wish.occasion && g.occasion?.toLowerCase().includes(wish.occasion.toLowerCase())) score += 1;
      return { g, score };
    })
    .sort((a, b) => b.score - a.score || a.g.priceCents - b.g.priceCents)
    .map((x) => x.g);
}

export async function POST(req: Request) {
  const openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!openAiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY. Add it to .env (see .env.example)." },
      { status: 500 },
    );
  }
  if (!looksLikeRealOpenAiKey(openAiKey)) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is still a placeholder or too short. Create a secret key at https://platform.openai.com/api-keys and paste the full key into .env.",
      },
      { status: 500 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Missing DATABASE_URL. Add your Neon connection string to .env." },
      { status: 500 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsedBody = parseAndValidateBody(json, bodySchema);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { query, includeSeo, modelOverride } = parsedBody.data;
  const model = getSuggestionModel(modelOverride);

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "anonymous";

  const redis = getRedis();
  if (redis) {
    const key = `ratelimit:suggest:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > 60) {
      return NextResponse.json({ error: "Too many requests - try again in a bit." }, { status: 429 });
    }
  }

  let wish: ParsedWish;
  try {
    const out = await generateObject({
      model,
      schema: wishSchema,
      system: `You extract structured gift-shopping intent from a single user message.
Return budgetMaxCents in US cents when possible (e.g. $25 -> 2500). If budget is missing, set budgetMaxCents to null.
Normalize interests to short lowercase tokens when possible.`,
      prompt: query,
    });
    wish = out.object;
  } catch (e) {
    const mapped = openAiFriendlyError(e);
    if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    throw e;
  }

  const interestTags = wish.interests.map((i) => i.toLowerCase());
  const baseWhere = {
    ...(wish.budgetMaxCents ? { priceCents: { lte: wish.budgetMaxCents } as const } : {}),
  };

  let candidates: Gift[] = [];
  try {
    candidates = await prisma.gift.findMany({
      where: interestTags.length > 0 ? { ...baseWhere, tags: { hasSome: interestTags } } : baseWhere,
      take: 40,
      orderBy: { priceCents: "asc" },
    });

    if (candidates.length === 0) {
      candidates = await prisma.gift.findMany({
        where: baseWhere,
        take: 40,
        orderBy: { priceCents: "asc" },
      });
    }
  } catch {
    return NextResponse.json(
      { error: "Database query failed. Run prisma db push and prisma db seed against Neon." },
      { status: 500 },
    );
  }

  const ranked = rankGifts(wish, candidates).slice(0, 6);

  if (ranked.length === 0) {
    return NextResponse.json({
      wish,
      results: [],
      message: "No gifts matched the filters yet. Seed the catalog or relax constraints.",
    });
  }

  let copy: z.infer<typeof explanationsSchema>;
  try {
    const out = await generateObject({
      model,
      schema: explanationsSchema,
      system: `You write short, friendly explanations for why each gift fits the shopper's message.
${includeSeo ? "Also produce seoTitle and seoDescription per item: concise, honest, not keyword-stuffed." : "Do not include seoTitle or seoDescription."}
Ground claims only in the provided gift fields.`,
      prompt: JSON.stringify({
        userMessage: query,
        wish,
        gifts: ranked.map((g) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          priceCents: g.priceCents,
          tags: g.tags,
          audience: g.audience,
          occasion: g.occasion,
        })),
      }),
    });
    copy = out.object;
  } catch (e) {
    const mapped = openAiFriendlyError(e);
    if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    throw e;
  }

  const byId = new Map(ranked.map((g) => [g.id, g]));
  const items = copy.items
    .map((row) => {
      const gift = byId.get(row.giftId);
      if (!gift) return null;
      return {
        gift,
        explanation: row.explanation,
        ...(includeSeo ? { seoTitle: row.seoTitle, seoDescription: row.seoDescription } : {}),
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    wish,
    results: items,
  });
}
