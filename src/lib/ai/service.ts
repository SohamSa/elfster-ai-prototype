import { generateObject } from "ai";
import type { Gift } from "@prisma/client";
import { getSeoModel, getSuggestionModel } from "@/lib/ai/model";
import { giftExplanationPrompt, giftExplanationSystemPrompt, giftIntentSystemPrompt } from "@/lib/ai/prompts/suggest";
import { seoBriefPrompt, seoBriefSystemPrompt } from "@/lib/ai/prompts/seo-brief";
import { looksLikeRealOpenAiKey, openAiFriendlyError } from "@/lib/ai/guards";
import { giftExplanationsSchema, type GiftExplanations } from "@/lib/schemas/suggest";
import { seoBriefSchema, type SeoBrief } from "@/lib/schemas/seo-discovery";
import { wishSchema, type ParsedWish } from "@/lib/schemas/wish";

export type AiMode = "mock" | "live";

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function isMockAiMode(): boolean {
  const raw = process.env.MOCK_AI_MODE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function getAiMode(): AiMode {
  return isMockAiMode() ? "mock" : "live";
}

export function getAiConfigurationError(): { message: string; status: number } | null {
  if (isMockAiMode()) return null;
  const openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!openAiKey) {
    return { message: "Missing OPENAI_API_KEY. Add it to .env (see .env.example), or set MOCK_AI_MODE=true for local development.", status: 500 };
  }
  if (!looksLikeRealOpenAiKey(openAiKey)) {
    return {
      message:
        "OPENAI_API_KEY is still a placeholder or too short. Create a secret key at https://platform.openai.com/api-keys, or set MOCK_AI_MODE=true for local development.",
      status: 500,
    };
  }
  return null;
}

function parseBudgetCents(query: string): number | null {
  const match = query.match(/(?:under|below|less than|budget|around|up to)?\s*\$?\s*(\d{1,5})/i);
  if (!match?.[1]) return null;
  const dollars = Number.parseInt(match[1], 10);
  return Number.isFinite(dollars) && dollars > 0 ? dollars * 100 : null;
}

function inferRecipient(query: string): string | null {
  const lower = query.toLowerCase();
  const recipients = ["coworker", "sister", "brother", "mom", "dad", "friend", "teacher", "partner", "boss", "secret santa"];
  return recipients.find((r) => lower.includes(r)) ?? null;
}

function inferOccasion(query: string): string | null {
  const lower = query.toLowerCase();
  const occasions = ["birthday", "christmas", "holiday", "wedding", "anniversary", "graduation", "secret santa"];
  return occasions.find((o) => lower.includes(o)) ?? null;
}

function inferInterests(query: string): string[] {
  const lower = query.toLowerCase();
  const known = ["coffee", "tea", "baking", "books", "fitness", "travel", "plants", "desk", "remote", "cozy", "tech"];
  const hits = known.filter((token) => lower.includes(token));
  return hits.length > 0 ? hits : ["thoughtful"];
}

function mockWish(query: string): ParsedWish {
  return wishSchema.parse({
    budgetMaxCents: parseBudgetCents(query),
    interests: inferInterests(query),
    recipient: inferRecipient(query),
    occasion: inferOccasion(query),
    notes: "Mock AI mode parsed this locally without calling OpenAI.",
  });
}

function mockExplanations(gifts: Gift[], includeSeo: boolean): GiftExplanations {
  return giftExplanationsSchema.parse({
    items: gifts.map((gift) => ({
      giftId: gift.id,
      explanation: `${gift.title} fits because it matches the shopper's constraints, stays grounded in the catalog, and has a clear gifting use case.`,
      ...(includeSeo
        ? {
            seoTitle: `${gift.title} Gift Idea`,
            seoDescription: `${gift.title} is a practical gift option with clear fit signals from the catalog and a simple reason to choose it.`,
          }
        : {}),
    })),
  });
}

function fitMeta(text: string): string {
  let s = text.trim();
  const filler = " Compare thoughtful, budget-aware ideas with practical sections, FAQs, freshness notes, and conversion tips.";
  while (s.length < 130) s += filler;
  if (s.length > 160) s = `${s.slice(0, 159).trimEnd()}…`;
  return s;
}

function mockSeoBrief(query: string): SeoBrief {
  const title = `Gift Ideas for ${query}`.slice(0, 64);
  return seoBriefSchema.parse({
    canonicalQuery: query,
    searchIntent: "mixed",
    title,
    metaDescription: fitMeta(`Find ${query} with budget-aware picks, recipient fit, seasonal planning, and simple guidance for confident gifting.`),
    h1: title,
    intro: `This mock brief explains how an AI gifting page can answer "${query}" with grounded recommendations, helpful context, and clear next steps.`,
    sections: [
      { heading: "Shopper intent", summary: "Clarify recipient, budget, occasion, and interests before recommending products." },
      { heading: "Gift matching angle", summary: "Use catalog facts first, then AI language to explain why each idea fits." },
      { heading: "Budget and availability", summary: "Keep options within the requested range and avoid suggesting unavailable or unrealistic items." },
      { heading: "Seasonal refresh plan", summary: "Update examples and related queries before holidays or recurring gift moments." },
    ],
    faqs: [
      { question: "How should this page choose gifts?", answer: "Start with catalog filters, then rank by recipient, occasion, interest, and price fit." },
      { question: "Why use AI here?", answer: "AI helps interpret plain-language queries and explain grounded matches in a friendly way." },
      { question: "How does the page stay trustworthy?", answer: "Keep claims tied to stored product data and review generated content before publishing." },
    ],
    conversionNudges: ["Show price and recipient fit clearly.", "Add save-to-list or compare actions.", "Use plain explanations near each recommendation."],
    freshnessNotes: ["Refresh seasonal examples quarterly.", "Review low-performing pages after enough impressions.", "Update related queries around holidays."],
    duplicateRisk: "medium",
    internalLinkAnchors: ["budget gift ideas", "gifts by recipient", "seasonal gift guides"],
    relatedQueries: [`${query} under $25`, `${query} for coworkers`, `${query} last minute`],
  });
}

function rethrowFriendly(error: unknown): never {
  const mapped = openAiFriendlyError(error);
  if (mapped) {
    throw new AiServiceError(mapped.message, mapped.status);
  }
  throw error;
}

export async function extractGiftIntent(input: {
  query: string;
  modelOverride?: string;
}): Promise<ParsedWish> {
  if (isMockAiMode()) return mockWish(input.query);

  try {
    const out = await generateObject({
      model: getSuggestionModel(input.modelOverride),
      schema: wishSchema,
      system: giftIntentSystemPrompt(),
      prompt: input.query,
    });
    return wishSchema.parse(out.object);
  } catch (error) {
    rethrowFriendly(error);
  }
}

export async function writeGiftExplanations(input: {
  query: string;
  wish: ParsedWish;
  gifts: Gift[];
  includeSeo: boolean;
  modelOverride?: string;
}): Promise<GiftExplanations> {
  if (isMockAiMode()) return mockExplanations(input.gifts, input.includeSeo);

  try {
    const out = await generateObject({
      model: getSuggestionModel(input.modelOverride),
      schema: giftExplanationsSchema,
      system: giftExplanationSystemPrompt(input.includeSeo),
      prompt: giftExplanationPrompt(input.query, input.wish, input.gifts),
    });
    return giftExplanationsSchema.parse(out.object);
  } catch (error) {
    rethrowFriendly(error);
  }
}

export async function generateSeoBrief(input: {
  query: string;
  locale: string;
  audienceHint?: string;
  modelOverride?: string;
  systemExtra?: string;
}): Promise<SeoBrief> {
  if (isMockAiMode()) return mockSeoBrief(input.query);

  try {
    const out = await generateObject({
      model: getSeoModel(input.modelOverride),
      schema: seoBriefSchema,
      system: seoBriefSystemPrompt(input.systemExtra ?? ""),
      prompt: seoBriefPrompt({
        query: input.query,
        locale: input.locale,
        audienceHint: input.audienceHint,
      }),
    });
    return seoBriefSchema.parse(out.object);
  } catch (error) {
    rethrowFriendly(error);
  }
}
