import type { SeoBrief } from "@/lib/schemas/seo-discovery";

/** Lowercase substrings that must not appear in customer-facing SEO copy. */
const BANNED_PHRASES = [
  "miracle",
  "guaranteed cure",
  "100% cure",
  "fda approved",
  "clinically proven",
  "lose weight fast",
  "get rich quick",
  "risk-free investment",
  "no risk",
  "double your money",
  "100% free money",
  "act now or",
  "limited time only!!!",
  "click here now",
];

/** Regex patterns (case-insensitive) for risky or disallowed claims. */
const BANNED_PATTERNS: RegExp[] = [
  /\bguarantee(s|d)?\s+(cure|heal|fix)\b/i,
  /\b(cure|treat|diagnose)\s+(cancer|diabetes|covid)\b/i,
  /\b100%\s+(effective|safe|guaranteed)\b/i,
];

function collectText(brief: SeoBrief): string {
  const parts = [
    brief.title,
    brief.metaDescription,
    brief.h1,
    brief.intro,
    ...brief.sections.flatMap((s) => [s.heading, s.summary]),
    ...brief.faqs.flatMap((f) => [f.question, f.answer]),
    ...brief.internalLinkAnchors,
    ...brief.relatedQueries,
    ...brief.freshnessNotes,
    ...brief.conversionNudges,
  ];
  return parts.join("\n").toLowerCase();
}

export type BrandGuardrailResult = {
  violations: string[];
};

/**
 * Returns human-readable violation codes. Empty list means pass.
 */
export function evaluateBrandGuardrails(brief: SeoBrief): BrandGuardrailResult {
  const violations: string[] = [];
  const haystack = collectText(brief);

  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase.toLowerCase())) {
      violations.push(`banned-phrase:${phrase}`);
    }
  }
  for (let i = 0; i < BANNED_PATTERNS.length; i++) {
    const re = BANNED_PATTERNS[i];
    if (re.test(haystack)) {
      violations.push(`banned-pattern:${i}`);
    }
  }

  const titleUpperRatio =
    brief.title.replace(/[^A-Z]/g, "").length / Math.max(brief.title.replace(/[^a-zA-Z]/g, "").length, 1);
  if (titleUpperRatio > 0.6 && brief.title.length > 10) {
    violations.push("title-too-many-caps");
  }

  return { violations };
}
