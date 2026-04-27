import { z } from "zod";

export const suggestRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  includeSeo: z.boolean().optional(),
  modelOverride: z.string().min(3).max(80).optional(),
});

export const giftExplanationSchema = z.object({
  giftId: z.string(),
  explanation: z.string(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export const giftExplanationsSchema = z.object({
  items: z.array(giftExplanationSchema),
});

export type SuggestRequest = z.infer<typeof suggestRequestSchema>;
export type GiftExplanations = z.infer<typeof giftExplanationsSchema>;
