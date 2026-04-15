import { z } from "zod";

export const wishSchema = z.object({
  budgetMaxCents: z.number().int().positive().nullable().describe("Maximum budget in cents, null if unknown"),
  interests: z.array(z.string()).describe("Hobbies, likes, or vibe words"),
  recipient: z
    .string()
    .nullable()
    .describe("Who the gift is for, e.g. coworker, sister, secret santa"),
  occasion: z.string().nullable().describe("Occasion or season if mentioned"),
  notes: z.string().nullable().describe("Any other useful constraints"),
});

export type ParsedWish = z.infer<typeof wishSchema>;
