import { NextResponse } from "next/server";

export function GET() {
  const mockAiMode = process.env.MOCK_AI_MODE === "true" || process.env.MOCK_AI_MODE === "1";
  return NextResponse.json({
    ok: true,
    service: "elfster-ai-prototype",
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    mockAiMode,
    aiMode: mockAiMode ? "mock" : "live",
    hasUpstash: Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
    ),
  });
}
