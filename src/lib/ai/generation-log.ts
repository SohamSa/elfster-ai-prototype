import { prisma } from "@/lib/prisma";
import { getAiMode } from "@/lib/ai/service";
import type { Prisma } from "@prisma/client";

type AiGenerationLogInput = {
  route: string;
  query: string;
  status: "success" | "empty" | "error";
  model?: string;
  inputJson?: unknown;
  outputJson?: unknown;
  error?: string;
  latencyMs?: number;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Best-effort persistence for generated AI work.
 * If the new table has not been pushed yet, the user-facing request should still succeed.
 */
export async function recordAiGeneration(input: AiGenerationLogInput): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.aiGeneration.create({
      data: {
        route: input.route,
        query: input.query,
        mode: getAiMode(),
        status: input.status,
        model: input.model,
        inputJson: toJsonValue(input.inputJson),
        outputJson: toJsonValue(input.outputJson),
        error: input.error,
        latencyMs: input.latencyMs,
      },
    });
  } catch {
    // Logging should never make the recommendation or brief route fail.
  }
}
