import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  AiServiceError,
  extractGiftIntent,
  getAiConfigurationError,
  writeGiftExplanations,
} from "@/lib/ai/service";
import { parseAndValidateBody } from "@/lib/ai/guards";
import { recordAiGeneration } from "@/lib/ai/generation-log";
import {
  checkOptionalRateLimit,
  jsonCacheKey,
  readOptionalJsonCache,
  writeOptionalJsonCache,
} from "@/lib/ai/traffic-control";
import { prisma } from "@/lib/prisma";
import { suggestRequestSchema, type GiftExplanations } from "@/lib/schemas/suggest";
import type { ParsedWish } from "@/lib/schemas/wish";
import type { Gift } from "@prisma/client";

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
  const startedAt = Date.now();
  const aiConfigError = getAiConfigurationError();
  if (aiConfigError) {
    return NextResponse.json({ error: aiConfigError.message }, { status: aiConfigError.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Missing DATABASE_URL. Add your Neon connection string to .env." },
      { status: 500 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsedBody = parseAndValidateBody(json, suggestRequestSchema);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { query, includeSeo = false, modelOverride } = parsedBody.data;
  const modelLabel = modelOverride ?? process.env.OPENAI_SUGGESTION_MODEL ?? "gpt-4o";

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "anonymous";

  const rate = await checkOptionalRateLimit({
    key: `ratelimit:suggest:${ip}`,
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: rate.message }, { status: rate.status });
  }

  const cacheKey = jsonCacheKey("cache:suggest:v1", { query, includeSeo, modelLabel });
  const cached = await readOptionalJsonCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  let wish: ParsedWish;
  try {
    // Step 1: turn natural language into a small structured "wish" object.
    wish = await extractGiftIntent({ query, modelOverride });
  } catch (e) {
    await recordAiGeneration({
      route: "/api/suggest",
      query,
      status: "error",
      model: modelLabel,
      inputJson: parsedBody.data,
      error: e instanceof Error ? e.message : "Unknown AI error",
      latencyMs: Date.now() - startedAt,
    });
    if (e instanceof AiServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const interestTags = wish.interests.map((i) => i.toLowerCase());
  const baseWhere = {
    ...(wish.budgetMaxCents ? { priceCents: { lte: wish.budgetMaxCents } as const } : {}),
  };

  let candidates: Gift[] = [];
  try {
    // Step 2: use the parsed constraints to filter real catalog rows before ranking.
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
    const response = {
      wish,
      results: [],
      message: "No gifts matched the filters yet. Seed the catalog or relax constraints.",
    };
    await recordAiGeneration({
      route: "/api/suggest",
      query,
      status: "empty",
      model: modelLabel,
      inputJson: parsedBody.data,
      outputJson: response,
      latencyMs: Date.now() - startedAt,
    });
    await writeOptionalJsonCache(cacheKey, response, 300);
    return NextResponse.json(response);
  }

  let copy: GiftExplanations;
  try {
    // Step 3: ask AI only to explain already-selected gifts, keeping claims grounded.
    copy = await writeGiftExplanations({ query, wish, gifts: ranked, includeSeo, modelOverride });
  } catch (e) {
    await recordAiGeneration({
      route: "/api/suggest",
      query,
      status: "error",
      model: modelLabel,
      inputJson: { ...parsedBody.data, wish, candidateIds: ranked.map((g) => g.id) },
      error: e instanceof Error ? e.message : "Unknown AI error",
      latencyMs: Date.now() - startedAt,
    });
    if (e instanceof AiServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
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

  const response = {
    wish,
    results: items,
  };
  await recordAiGeneration({
    route: "/api/suggest",
    query,
    status: "success",
    model: modelLabel,
    inputJson: parsedBody.data,
    outputJson: response,
    latencyMs: Date.now() - startedAt,
  });
  await writeOptionalJsonCache(cacheKey, response, 300);
  return NextResponse.json(response);
}
