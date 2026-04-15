import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { businessProblems } from "@/lib/seo/business-problems";
import { getStructuralQualityFlags, normalizeStructuralBrief } from "@/lib/seo/brief-fallback";
import { getSeoModel } from "@/lib/ai/model";
import {
  looksLikeRealOpenAiKey,
  openAiFriendlyError,
  parseAndValidateBody,
} from "@/lib/ai/guards";
import { seoBriefRequestSchema, seoBriefSchema } from "@/lib/schemas/seo-discovery";

export async function POST(req: Request) {
  const openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!openAiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY. Add it to .env (see .env.example)." },
      { status: 500 },
    );
  }
  if (!looksLikeRealOpenAiKey(openAiKey)) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY looks invalid or placeholder. Update .env with a real key." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = parseAndValidateBody(body, seoBriefRequestSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { query, locale, audienceHint } = parsed.data;
  const model = getSeoModel(parsed.data.modelOverride);

  const baseSystem = `You generate business-grade SEO/discovery page briefs for an AI gifting platform.
Write clear, practical copy in plain language.
Explicitly optimize for these 10 business problems:
${businessProblems.map((p, i) => `${i + 1}. ${p.name}`).join("\n")}
Rules:
- Keep the title under 65 characters.
- Keep the metaDescription between 130 and 160 characters.
- Include at least 4 sections, each with a heading and summary.
- Include at least 3 FAQs with specific answers.
- Sections should be useful and skimmable, not generic.
- Include conversionNudges that can increase click-through and action.
- Include freshnessNotes for how this page can stay current.
- Estimate duplicateRisk honestly based on how broad the query is.
- internalLinkAnchors should sound like natural anchor text.
- relatedQueries should be long-tail and realistic.
`;

  let systemExtra = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateObject({
        model,
        schema: seoBriefSchema,
        system: baseSystem + systemExtra,
        prompt: JSON.stringify({ query, locale, audienceHint }),
      });

      let brief = result.object;
      const structural = getStructuralQualityFlags(brief);

      if (structural.length === 0) {
        return NextResponse.json({
          ok: true,
          input: { query, locale, audienceHint },
          brief,
          businessProblemsCovered: businessProblems.map((p) => p.name),
        });
      }

      if (attempt === 0) {
        systemExtra = `\n\nYour previous output failed structural checks: ${structural.join(", ")}. Regenerate the full brief and fix every issue (title length, meta length 130-160, at least 4 sections, at least 3 FAQs).`;
        continue;
      }

      const structuralWarnings = structural;
      brief = normalizeStructuralBrief(brief, query);

      return NextResponse.json({
        ok: true,
        input: { query, locale, audienceHint },
        brief,
        businessProblemsCovered: businessProblems.map((p) => p.name),
        incompleteFallback: true,
        structuralWarnings,
      });
    } catch (error) {
      if (attempt === 0) {
        systemExtra =
          "\n\nYour previous response was invalid or could not be parsed. Output valid JSON matching the schema with all required fields.";
        continue;
      }
      const mapped = openAiFriendlyError(error);
      if (mapped) {
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
      }
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
