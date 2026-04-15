import type { SeoBrief } from "@/lib/schemas/seo-discovery";
import { evaluateQuality } from "@/lib/seo/brief-quality";

const MIN_SECTIONS = 4;
const MIN_FAQS = 3;
const META_MIN = 130;
const META_MAX = 160;
const TITLE_MAX = 65;

/** Quality checks that block approve/publish, excluding duplicate-risk (editorial). */
export function getStructuralQualityFlags(brief: SeoBrief): string[] {
  return evaluateQuality(brief).qualityFlags.filter((f) => f !== "high-duplicate-risk");
}

function padMeta(description: string, query: string): string {
  let s = description.trim();
  if (s.length >= META_MIN && s.length <= META_MAX) return s;
  if (s.length > META_MAX) {
    return `${s.slice(0, META_MAX - 1).trimEnd()}\u2026`;
  }
  const filler =
    ` This guide covers practical picks and tips for: ${query.slice(0, 80)}.`.trim();
  while (s.length < META_MIN && filler.length > 0) {
    s = (s + filler).slice(0, META_MAX);
    if (s.length >= META_MIN) break;
  }
  if (s.length < META_MIN) {
    s = `${s} Thoughtful gifting ideas, budgets, and timing.`.slice(0, META_MAX);
  }
  if (s.length > META_MAX) {
    s = `${s.slice(0, META_MAX - 1).trimEnd()}\u2026`;
  }
  return s;
}

function truncateTitle(title: string, query: string): string {
  const t = title.trim() || query.slice(0, TITLE_MAX);
  if (t.length <= TITLE_MAX) return t;
  return `${t.slice(0, TITLE_MAX - 1).trimEnd()}\u2026`;
}

/**
 * Ensures title/meta/section/FAQ counts meet product minimums so the brief can be saved
 * and moved through review. Does not change duplicateRisk.
 */
export function normalizeStructuralBrief(brief: SeoBrief, query: string): SeoBrief {
  const q = query.trim() || "gift shoppers";
  const title = truncateTitle(brief.title, q);
  const metaDescription = padMeta(brief.metaDescription || brief.intro || title, q);
  const canonicalQuery = brief.canonicalQuery.trim() || q;

  const sections = [...brief.sections];
  const sectionStubs = [
    { heading: "What to prioritize", summary: `Key buying criteria for "${q}" including fit, usefulness, and delivery timing.` },
    { heading: "Budget-friendly options", summary: "Ideas that feel thoughtful without overspending, plus where trade-offs usually show up." },
    { heading: "Presentation and delivery", summary: "Packaging, digital gifts, and remote-friendly ways to make the moment feel personal." },
    { heading: "Common mistakes to avoid", summary: "Generic picks, late shipping, mismatched tastes, and how to sidestep them." },
  ];
  let stubIdx = 0;
  while (sections.length < MIN_SECTIONS) {
    sections.push({ ...sectionStubs[stubIdx % sectionStubs.length]! });
    stubIdx++;
  }

  const faqs = [...brief.faqs];
  const faqStubs = [
    { question: `What makes a good gift for this query: "${q}"?`, answer: "Prioritize usefulness, personal taste signals you have already observed, and a clear story for why it fits them." },
    { question: "How much should I spend?", answer: "Match spend to your relationship and norms for the occasion; the prototype focuses on clarity of intent over price alone." },
    { question: "What if I do not know their size or preferences?", answer: "Choose categories with flexible sizing, consumables with broad appeal, or experiences with easy exchanges." },
  ];
  let fi = 0;
  while (faqs.length < MIN_FAQS) {
    faqs.push({ ...faqStubs[fi % faqStubs.length]! });
    fi++;
  }

  return {
    ...brief,
    canonicalQuery,
    title,
    metaDescription,
    h1: brief.h1.trim() || title,
    intro: brief.intro.trim() || `Here is a practical overview for people searching: ${q}.`,
    sections,
    faqs,
  };
}
