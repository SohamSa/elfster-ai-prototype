import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seoBriefSchema } from "@/lib/schemas/seo-discovery";
import { evaluateBrandGuardrails } from "@/lib/seo/brand-guardrails";
import { evaluateQuality, qualityViolationsForStatus } from "@/lib/seo/brief-quality";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const row = await prisma.savedSeoBrief.findUnique({
    where: { id },
    select: {
      query: true,
      locale: true,
      status: true,
      briefJson: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Brief not found." }, { status: 404 });
  }

  if (row.status !== "approved" && row.status !== "published") {
    return NextResponse.json(
      { error: "Export is only available for approved or published briefs." },
      { status: 403 },
    );
  }

  const parsed = seoBriefSchema.safeParse(row.briefJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "Stored brief is invalid." }, { status: 500 });
  }
  const b = parsed.data;

  const quality = evaluateQuality(b);
  const brand = evaluateBrandGuardrails(b);
  const violations = [
    ...brand.violations,
    ...qualityViolationsForStatus(row.status, quality.qualityFlags),
  ];
  if (violations.length > 0) {
    return NextResponse.json(
      {
        error: "Brief no longer passes brand or quality checks; fix content or status before export.",
        violations,
      },
      { status: 422 },
    );
  }

  const md = [
    `# ${b.h1}`,
    "",
    `- Query: ${row.query}`,
    `- Locale: ${row.locale}`,
    `- Status: ${row.status}`,
    `- Created: ${row.createdAt.toISOString()}`,
    row.publishedAt ? `- Published: ${row.publishedAt.toISOString()}` : "",
    "",
    `## SEO Meta`,
    "",
    `- Title: ${b.title}`,
    `- Description: ${b.metaDescription}`,
    "",
    `## Intro`,
    "",
    b.intro,
    "",
    `## Sections`,
    "",
    ...b.sections.map((s) => `### ${s.heading}\n\n${s.summary}\n`),
    `## FAQs`,
    "",
    ...b.faqs.map((f) => `- **${f.question}**: ${f.answer}`),
    "",
    `## Internal Link Anchors`,
    "",
    ...b.internalLinkAnchors.map((x) => `- ${x}`),
    "",
    `## Related Queries`,
    "",
    ...b.relatedQueries.map((x) => `- ${x}`),
    "",
    `## Freshness Notes`,
    "",
    ...b.freshnessNotes.map((x) => `- ${x}`),
    "",
    `## Conversion Nudges`,
    "",
    ...b.conversionNudges.map((x) => `- ${x}`),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return NextResponse.json({ ok: true, markdown: md });
}
