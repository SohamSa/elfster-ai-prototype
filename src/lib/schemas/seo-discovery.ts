import { z } from "zod";

export const seoBriefRequestSchema = z.object({
  query: z.string().min(3).max(300),
  locale: z.string().default("en-US"),
  audienceHint: z.string().max(120).optional(),
  modelOverride: z.string().min(3).max(80).optional(),
});

export const seoBriefSchema = z.object({
  canonicalQuery: z.string(),
  searchIntent: z.enum(["informational", "commercial", "transactional", "mixed"]),
  title: z.string(),
  metaDescription: z.string(),
  h1: z.string(),
  intro: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      summary: z.string(),
    }),
  ),
  faqs: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
  conversionNudges: z.array(z.string()),
  freshnessNotes: z.array(z.string()),
  duplicateRisk: z.enum(["low", "medium", "high"]),
  internalLinkAnchors: z.array(z.string()),
  relatedQueries: z.array(z.string()),
});

export type SeoBriefRequest = z.infer<typeof seoBriefRequestSchema>;
export type SeoBrief = z.infer<typeof seoBriefSchema>;
