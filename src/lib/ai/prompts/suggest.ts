import type { Gift } from "@prisma/client";
import type { ParsedWish } from "@/lib/schemas/wish";

export function giftIntentSystemPrompt(): string {
  return `You extract structured gift-shopping intent from a single user message.
Return budgetMaxCents in US cents when possible (e.g. $25 -> 2500). If budget is missing, set budgetMaxCents to null.
Normalize interests to short lowercase tokens when possible.`;
}

export function giftExplanationSystemPrompt(includeSeo: boolean): string {
  return `You write short, friendly explanations for why each gift fits the shopper's message.
${includeSeo ? "Also produce seoTitle and seoDescription per item: concise, honest, not keyword-stuffed." : "Do not include seoTitle or seoDescription."}
Ground claims only in the provided gift fields.`;
}

export function giftExplanationPrompt(query: string, wish: ParsedWish, gifts: Gift[]): string {
  return JSON.stringify({
    userMessage: query,
    wish,
    gifts: gifts.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      priceCents: g.priceCents,
      tags: g.tags,
      audience: g.audience,
      occasion: g.occasion,
    })),
  });
}
