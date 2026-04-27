import type { Gift } from "@prisma/client";

type FixtureResult = {
  id: string;
  ok: boolean;
  checks: string[];
};

function assertCheck(condition: boolean, label: string, checks: string[]) {
  checks.push(`${label}: ${condition ? "ok" : "fail"}`);
  if (!condition) throw new Error(label);
}

async function main() {
  // This eval is intentionally offline: it validates orchestration, schemas, and mock outputs
  // without spending any OpenAI budget.
  process.env.MOCK_AI_MODE = "true";

  const { extractGiftIntent, generateSeoBrief, writeGiftExplanations } = await import("../src/lib/ai/service");
  const { giftExplanationsSchema } = await import("../src/lib/schemas/suggest");
  const { seoBriefSchema } = await import("../src/lib/schemas/seo-discovery");
  const { wishSchema } = await import("../src/lib/schemas/wish");

  const gift: Gift = {
    id: "fixture-gift-1",
    title: "Coffee Sampler Box",
    description: "A small set of coffee blends for a desk-friendly gift.",
    priceCents: 2400,
    tags: ["coffee", "coworker", "desk"],
    audience: "coworker",
    occasion: "holiday",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const results: FixtureResult[] = [];

  const suggestChecks: string[] = [];
  const wish = await extractGiftIntent({ query: "gift for coworker under $25 who likes coffee" });
  assertCheck(wishSchema.safeParse(wish).success, "wish schema", suggestChecks);
  assertCheck(wish.budgetMaxCents === 2500, "budget parsed", suggestChecks);
  assertCheck(wish.recipient === "coworker", "recipient parsed", suggestChecks);

  const copy = await writeGiftExplanations({
    query: "gift for coworker under $25 who likes coffee",
    wish,
    gifts: [gift],
    includeSeo: true,
  });
  assertCheck(giftExplanationsSchema.safeParse(copy).success, "explanation schema", suggestChecks);
  assertCheck(copy.items.length === 1 && copy.items[0]?.giftId === gift.id, "explanation maps to gift", suggestChecks);
  results.push({ id: "mock-suggest-flow", ok: true, checks: suggestChecks });

  const seoChecks: string[] = [];
  const brief = await generateSeoBrief({
    query: "gift for remote coworker under $30 who likes coffee",
    locale: "en-US",
    audienceHint: "office gift shoppers",
  });
  assertCheck(seoBriefSchema.safeParse(brief).success, "seo brief schema", seoChecks);
  assertCheck(brief.sections.length >= 4, "minimum sections", seoChecks);
  assertCheck(brief.faqs.length >= 3, "minimum faqs", seoChecks);
  assertCheck(brief.metaDescription.length >= 130 && brief.metaDescription.length <= 160, "meta length", seoChecks);
  results.push({ id: "mock-seo-flow", ok: true, checks: seoChecks });

  console.log(JSON.stringify({ ok: true, mode: "mock", results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
