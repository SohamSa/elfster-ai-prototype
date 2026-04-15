export type BusinessProblem = {
  id: string;
  name: string;
  whyItMatters: string;
  aiApproach: string;
};

export const businessProblems: BusinessProblem[] = [
  {
    id: "long-tail-coverage",
    name: "Long-tail query coverage",
    whyItMatters: "Highly specific gift searches are where buying intent is strongest.",
    aiApproach: "Create focused page briefs for specific recipient, budget, and occasion combinations.",
  },
  {
    id: "intent-mismatch",
    name: "Intent mismatch",
    whyItMatters: "A ranking page still fails if it solves the wrong shopper need.",
    aiApproach: "Classify intent and tune headings/copy to match what the query is truly asking.",
  },
  {
    id: "ranking-relevance",
    name: "Weak ranking relevance",
    whyItMatters: "Broad pages often underperform against focused competitors.",
    aiApproach: "Generate narrow, query-first titles, H1s, and section plans.",
  },
  {
    id: "duplication",
    name: "Content duplication",
    whyItMatters: "Near-identical pages dilute trust and search performance.",
    aiApproach: "Detect overlap risk and add distinct angles, examples, and wording.",
  },
  {
    id: "thin-pages",
    name: "Thin category pages",
    whyItMatters: "Short, shallow pages rarely satisfy users or search engines.",
    aiApproach: "Expand pages with useful sections, FAQs, and practical shopping guidance.",
  },
  {
    id: "internal-links",
    name: "Internal linking gaps",
    whyItMatters: "Weak linking makes pages harder to discover and navigate.",
    aiApproach: "Recommend contextual internal anchors and related page targets.",
  },
  {
    id: "freshness",
    name: "Content freshness drift",
    whyItMatters: "Holiday and trend-sensitive pages lose value when stale.",
    aiApproach: "Generate freshness notes and suggested update cadence.",
  },
  {
    id: "conversion",
    name: "Low conversion from SEO traffic",
    whyItMatters: "Traffic without action does not drive business outcomes.",
    aiApproach: "Propose clear conversion nudges and value-focused copy improvements.",
  },
  {
    id: "new-item-discovery",
    name: "Poor discovery for new gift ideas",
    whyItMatters: "New inventory can be invisible behind older high-traffic pages.",
    aiApproach: "Blend proven and fresh gift angles in briefs and related-query sets.",
  },
  {
    id: "brand-consistency",
    name: "Inconsistent tone and trust",
    whyItMatters: "Inconsistent page quality weakens brand confidence.",
    aiApproach: "Use structured prompt rules that enforce a consistent, clear brand voice.",
  },
];
