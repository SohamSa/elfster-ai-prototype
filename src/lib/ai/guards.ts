import { z } from "zod";

export function looksLikeRealOpenAiKey(key: string): boolean {
  const k = key.trim();
  if (!k.startsWith("sk-")) return false;
  if (k === "sk-..." || k.includes("...")) return false;
  if (k.length < 20) return false;
  return true;
}

export function openAiFriendlyError(error: unknown): { message: string; status: number } | null {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  const lower = raw.toLowerCase();

  if (lower.includes("insufficient_quota") || lower.includes("exceeded your current quota")) {
    return {
      message:
        "OpenAI returned insufficient quota. The key is valid, but API billing/credits are not active for this account. ChatGPT Plus does not cover API calls. Enable billing at https://platform.openai.com/account/billing and try again.",
      status: 503,
    };
  }

  if (lower.includes("rate_limit") || lower.includes("429")) {
    return {
      message: "OpenAI rate limit reached. Wait briefly and retry.",
      status: 429,
    };
  }

  if (lower.includes("invalid_api_key") || lower.includes("incorrect api key")) {
    return {
      message: "OpenAI API key is invalid. Update OPENAI_API_KEY in .env with a valid key.",
      status: 401,
    };
  }

  return null;
}

export function parseAndValidateBody<T>(
  input: unknown,
  schema: z.ZodSchema<T>,
): { ok: true; data: T } | { ok: false } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };
  return { ok: true, data: parsed.data };
}
