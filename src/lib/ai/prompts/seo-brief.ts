import { businessProblems } from "@/lib/seo/business-problems";

export function seoBriefSystemPrompt(extra = ""): string {
  return `You generate business-grade SEO/discovery page briefs for an AI gifting platform.
Write clear, practical copy in plain language.
Explicitly optimize for these 10 business problems:
${businessProblems.map((p, i) => `${i + 1}. ${p.name}`).join("\n")}
Rules:
- Keep the title under 65 characters.
- Keep the metaDescription between 130 and 160 characters.
- Include at least 4 sections, each with a heading and summary.
- Include at least 3 FAQs with specific answers.
- Sections should be useful and skimmable, not generic.
- Include conversionNudges that can increase click-through and action.
- Include freshnessNotes for how this page can stay current.
- Estimate duplicateRisk honestly based on how broad the query is.
- internalLinkAnchors should sound like natural anchor text.
- relatedQueries should be long-tail and realistic.
${extra}`;
}

export function seoBriefPrompt(input: {
  query: string;
  locale: string;
  audienceHint?: string;
}): string {
  return JSON.stringify(input);
}
