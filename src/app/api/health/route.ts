import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "elfster-ai-prototype",
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasUpstash: Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
    ),
  });
}
