import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { AiServiceError, generateSeoBrief, getAiConfigurationError } from "@/lib/ai/service";
import { recordAiGeneration } from "@/lib/ai/generation-log";
import {
  checkOptionalRateLimit,
  jsonCacheKey,
  readOptionalJsonCache,
  writeOptionalJsonCache,
} from "@/lib/ai/traffic-control";
import { businessProblems } from "@/lib/seo/business-problems";
import { getStructuralQualityFlags, normalizeStructuralBrief } from "@/lib/seo/brief-fallback";
import { parseAndValidateBody } from "@/lib/ai/guards";
import { seoBriefRequestSchema } from "@/lib/schemas/seo-discovery";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const aiConfigError = getAiConfigurationError();
  if (aiConfigError) {
    return NextResponse.json({ error: aiConfigError.message }, { status: aiConfigError.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseAndValidateBody(body, seoBriefRequestSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { query, audienceHint } = parsed.data;
  const locale = parsed.data.locale ?? "en-US";
  const modelLabel = parsed.data.modelOverride ?? process.env.OPENAI_SEO_MODEL ?? process.env.OPENAI_SUGGESTION_MODEL ?? "gpt-4o";

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "anonymous";
  const rate = await checkOptionalRateLimit({
    key: `ratelimit:seo-brief:${ip}`,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: rate.message }, { status: rate.status });
  }

  const cacheKey = jsonCacheKey("cache:seo-brief:v1", {
    query,
    locale,
    audienceHint,
    modelLabel,
  });
  const cached = await readOptionalJsonCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  let systemExtra = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Step 1: generate a structured brief; the AI service handles live vs mock mode.
      let brief = await generateSeoBrief({
        query,
        locale,
        audienceHint,
        modelOverride: parsed.data.modelOverride,
        systemExtra,
      });
      const structural = getStructuralQualityFlags(brief);

      if (structural.length === 0) {
        const response = {
          ok: true,
          input: { query, locale, audienceHint },
          brief,
          businessProblemsCovered: businessProblems.map((p) => p.name),
        };
        await recordAiGeneration({
          route: "/api/seo/brief",
          query,
          status: "success",
          model: modelLabel,
          inputJson: parsed.data,
          outputJson: response,
          latencyMs: Date.now() - startedAt,
        });
        await writeOptionalJsonCache(cacheKey, response, 600);
        return NextResponse.json(response);
      }

      if (attempt === 0) {
        systemExtra = `\n\nYour previous output failed structural checks: ${structural.join(", ")}. Regenerate the full brief and fix every issue (title length, meta length 130-160, at least 4 sections, at least 3 FAQs).`;
        continue;
      }

      const structuralWarnings = structural;
      // Step 2: if the model is close but incomplete, fill structural gaps deterministically.
      brief = normalizeStructuralBrief(brief, query);

      const response = {
        ok: true,
        input: { query, locale, audienceHint },
        brief,
        businessProblemsCovered: businessProblems.map((p) => p.name),
        incompleteFallback: true,
        structuralWarnings,
      };
      await recordAiGeneration({
        route: "/api/seo/brief",
        query,
        status: "success",
        model: modelLabel,
        inputJson: parsed.data,
        outputJson: response,
        latencyMs: Date.now() - startedAt,
      });
      await writeOptionalJsonCache(cacheKey, response, 600);
      return NextResponse.json(response);
    } catch (error) {
      if (attempt === 0) {
        systemExtra =
          "\n\nYour previous response was invalid or could not be parsed. Output valid JSON matching the schema with all required fields.";
        continue;
      }
      if (error instanceof AiServiceError) {
        await recordAiGeneration({
          route: "/api/seo/brief",
          query,
          status: "error",
          model: modelLabel,
          inputJson: parsed.data,
          error: error.message,
          latencyMs: Date.now() - startedAt,
        });
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      await recordAiGeneration({
        route: "/api/seo/brief",
        query,
        status: "error",
        model: modelLabel,
        inputJson: parsed.data,
        error: error instanceof Error ? error.message : "Unknown SEO brief error",
        latencyMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "SEO brief generation failed. Please retry in a moment." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "SEO brief generation failed. Please retry in a moment." },
    { status: 500 },
  );
}
