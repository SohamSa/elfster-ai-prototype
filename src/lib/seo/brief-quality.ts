import type { SeoBrief } from "@/lib/schemas/seo-discovery";
import type { SeoBriefStatus } from "@/lib/types/seo-discovery";

const APPROVED_QUALITY_BLOCKERS = new Set([
  "meta-length-outside-130-160",
  "title-over-65",
  "insufficient-faqs",
  "insufficient-sections",
]);

export function evaluateQuality(brief: SeoBrief): { qualityFlags: string[]; qualityScore: number } {
  const flags: string[] = [];
  if (brief.metaDescription.length < 130 || brief.metaDescription.length > 160) {
    flags.push("meta-length-outside-130-160");
  }
  if (brief.title.length > 65) {
    flags.push("title-over-65");
  }
  if (brief.faqs.length < 3) {
    flags.push("insufficient-faqs");
  }
  if (brief.sections.length < 4) {
    flags.push("insufficient-sections");
  }
  if (brief.duplicateRisk === "high") {
    flags.push("high-duplicate-risk");
  }
  const score = Math.max(0, 1 - flags.length * 0.2);
  return { qualityFlags: flags, qualityScore: score };
}

/** Violation codes for quality rules that apply when moving to `status`. */
export function qualityViolationsForStatus(status: SeoBriefStatus, qualityFlags: string[]): string[] {
  if (status === "published") {
    return qualityFlags.map((f) => `quality:${f}`);
  }
  if (status === "approved") {
    return qualityFlags.filter((f) => APPROVED_QUALITY_BLOCKERS.has(f)).map((f) => `quality:${f}`);
  }
  return [];
}
