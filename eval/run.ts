import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seoLexicalScore, suggestLexicalScore } from "./heuristics";
import { bumpFacet, emptyFacetAgg, mcnemarPaired, mean, median, stdSample, wilson95, type FacetAgg } from "./stats";
import type { CaseResult, EvalCase, SeoCase, SuggestCase, VariantReport } from "./types";

const DEFAULT_OK_THRESHOLD = 0.85;
const DEFAULT_AGGREGATE_GATE = 0.8;

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    strict: argv.includes("--strict") || process.env.EVAL_STRICT === "1" || process.env.EVAL_STRICT === "true",
  };
}

function parseOkThreshold(): number {
  const raw = process.env.EVAL_OK_THRESHOLD?.trim();
  if (!raw) return DEFAULT_OK_THRESHOLD;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_OK_THRESHOLD;
}

function parseGateMin(): number {
  const raw = process.env.EVAL_GATE_MIN_PASS_RATE?.trim();
  if (!raw) return DEFAULT_AGGREGATE_GATE;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_AGGREGATE_GATE;
}

function chi2PApprox(chi2: number): number {
  if (chi2 >= 10.828) return 0.001;
  if (chi2 >= 6.635) return 0.01;
  if (chi2 >= 3.841) return 0.05;
  if (chi2 >= 2.706) return 0.1;
  return 1;
}

function parseJsonl(input: string): EvalCase[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line, i) => {
    try {
      return JSON.parse(line) as EvalCase;
    } catch {
      throw new Error(`Invalid JSON on line ${i + 1}`);
    }
  });
}

function facetsForCase(c: EvalCase): Record<string, string> {
  const m = c.meta ?? {};
  return {
    caseType: c.type,
    segment: m.segment ?? "unspecified",
    difficulty: m.difficulty ?? "unspecified",
    intentSurface: m.intentSurface ?? "unspecified",
    localeRegion: m.localeRegion ?? (c.type === "seo" ? c.locale ?? "default" : "default"),
    tags: (m.tags ?? []).slice(0, 4).join("|") || "none",
  };
}

async function postJson(baseUrl: string, endpoint: string, body: unknown) {
  const start = Date.now();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - start;
  const data = await res.json().catch(() => null);
  return { status: res.status, data, elapsed };
}

function strictSuggestExtras(
  strict: boolean,
  out: { results?: Array<{ gift?: { title?: string; description?: string } }> },
  checks: string[],
  passCount: { n: number },
  totalChecks: { n: number },
) {
  if (!strict) return;
  totalChecks.n += 1;
  const results = out.results ?? [];
  const titled = results.filter((r) => typeof r?.gift?.title === "string" && r.gift!.title.trim().length > 0);
  if (titled.length === results.length && results.length > 0) {
    passCount.n += 1;
    checks.push("strictAllTitles ok");
  } else {
    checks.push("strictAllTitles fail");
  }
}

async function evalSuggest(
  baseUrl: string,
  testCase: SuggestCase,
  model: string,
  okThreshold: number,
  strict: boolean,
): Promise<CaseResult> {
  const checks: string[] = [];
  const res = await postJson(baseUrl, "/api/suggest", {
    query: testCase.query,
    includeSeo: Boolean(testCase.includeSeo),
    modelOverride: model,
  });

  const caseWeight = testCase.meta?.weight ?? 1;
  const facets = facetsForCase(testCase);

  if (res.status !== 200 || !res.data) {
    return {
      id: testCase.id,
      type: "suggest",
      ok: false,
      score: 0,
      weightedScore: 0,
      caseWeight,
      latencyMs: res.elapsed,
      checks,
      meta: testCase.meta,
      facets,
      error: `HTTP ${res.status}`,
    };
  }

  const out = res.data as {
    wish?: { budgetMaxCents?: number | null; recipient?: string | null };
    results?: Array<{ gift?: { title?: string; description?: string; priceCents?: number } }>;
  };

  let passCount = 0;
  let totalChecks = 0;
  const pc = { n: passCount };
  const tc = { n: totalChecks };

  if (typeof testCase.expect.minResults === "number") {
    tc.n += 1;
    const n = Array.isArray(out.results) ? out.results.length : 0;
    if (n >= testCase.expect.minResults) {
      pc.n += 1;
      checks.push(`minResults ok (${n})`);
    } else {
      checks.push(`minResults fail (${n})`);
    }
  }

  if (typeof testCase.expect.budgetMaxCents === "number") {
    tc.n += 1;
    const prices = (out.results ?? [])
      .map((r) => r?.gift?.priceCents)
      .filter((v): v is number => typeof v === "number");
    const within = prices.length > 0 && prices.every((p) => p <= testCase.expect.budgetMaxCents!);
    if (within) {
      pc.n += 1;
      checks.push("budgetCompliance ok");
    } else {
      checks.push("budgetCompliance fail");
    }
  }

  if (typeof testCase.expect.recipientContains === "string") {
    tc.n += 1;
    const recipient = out.wish?.recipient?.toLowerCase() ?? "";
    const wanted = testCase.expect.recipientContains.toLowerCase();
    if (recipient.includes(wanted)) {
      pc.n += 1;
      checks.push(`recipientParse ok (${recipient})`);
    } else {
      checks.push(`recipientParse fail (${recipient || "empty"})`);
    }
  }

  const minLex = testCase.expect.minLexicalScore ?? (strict ? 0.28 : undefined);
  if (typeof minLex === "number") {
    tc.n += 1;
    const lex = suggestLexicalScore(testCase.query, out.results ?? []);
    if (lex >= minLex) {
      pc.n += 1;
      checks.push(`lexical ok (${lex.toFixed(3)} >= ${minLex})`);
    } else {
      checks.push(`lexical fail (${lex.toFixed(3)} < ${minLex})`);
    }
  }

  strictSuggestExtras(strict, out, checks, pc, tc);

  passCount = pc.n;
  totalChecks = tc.n;

  const score = totalChecks === 0 ? 0 : passCount / totalChecks;
  const ok = totalChecks > 0 && score >= okThreshold;
  return {
    id: testCase.id,
    type: "suggest",
    ok,
    score,
    weightedScore: caseWeight * score,
    caseWeight,
    latencyMs: res.elapsed,
    checks,
    meta: testCase.meta,
    facets,
  };
}

async function evalSeo(
  baseUrl: string,
  testCase: SeoCase,
  model: string,
  okThreshold: number,
  strict: boolean,
): Promise<CaseResult> {
  const checks: string[] = [];
  const res = await postJson(baseUrl, "/api/seo/brief", {
    query: testCase.query,
    locale: testCase.locale ?? "en-US",
    audienceHint: testCase.audienceHint,
    modelOverride: model,
  });

  const caseWeight = testCase.meta?.weight ?? 1;
  const facets = facetsForCase(testCase);

  if (res.status !== 200 || !res.data) {
    return {
      id: testCase.id,
      type: "seo",
      ok: false,
      score: 0,
      weightedScore: 0,
      caseWeight,
      latencyMs: res.elapsed,
      checks,
      meta: testCase.meta,
      facets,
      error: `HTTP ${res.status}`,
    };
  }

  const brief = (res.data as { brief?: Record<string, unknown> }).brief ?? {};
  const title = typeof brief.title === "string" ? brief.title : "";
  const meta = typeof brief.metaDescription === "string" ? brief.metaDescription : "";
  const h1 = typeof brief.h1 === "string" ? brief.h1 : "";
  const intro = typeof brief.intro === "string" ? brief.intro : "";
  const sections = Array.isArray(brief.sections) ? brief.sections.length : 0;
  const faqs = Array.isArray(brief.faqs) ? brief.faqs.length : 0;
  const related = Array.isArray(brief.relatedQueries) ? brief.relatedQueries.length : 0;
  const anchors = Array.isArray(brief.internalLinkAnchors) ? brief.internalLinkAnchors.length : 0;
  const nudges = Array.isArray(brief.conversionNudges) ? brief.conversionNudges.length : 0;
  const fresh = Array.isArray(brief.freshnessNotes) ? brief.freshnessNotes.length : 0;
  const dup = typeof brief.duplicateRisk === "string" ? brief.duplicateRisk : "";

  let passCount = 0;
  let totalChecks = 0;

  const runCheck = (pass: boolean, okMsg: string, failMsg: string) => {
    totalChecks += 1;
    if (pass) {
      passCount += 1;
      checks.push(okMsg);
    } else {
      checks.push(failMsg);
    }
  };

  if (typeof testCase.expect.titleMaxLen === "number") {
    runCheck(
      title.length > 0 && title.length <= testCase.expect.titleMaxLen,
      `titleLen ok (${title.length})`,
      `titleLen fail (${title.length})`,
    );
  }

  if (typeof testCase.expect.metaMinLen === "number") {
    runCheck(meta.length >= testCase.expect.metaMinLen, `metaMin ok (${meta.length})`, `metaMin fail (${meta.length})`);
  }

  if (typeof testCase.expect.metaMaxLen === "number") {
    runCheck(meta.length <= testCase.expect.metaMaxLen, `metaMax ok (${meta.length})`, `metaMax fail (${meta.length})`);
  }

  if (typeof testCase.expect.minSections === "number") {
    runCheck(sections >= testCase.expect.minSections, `sections ok (${sections})`, `sections fail (${sections})`);
  }

  if (typeof testCase.expect.minFaqs === "number") {
    runCheck(faqs >= testCase.expect.minFaqs, `faqs ok (${faqs})`, `faqs fail (${faqs})`);
  }

  if (typeof testCase.expect.minRelatedQueries === "number") {
    runCheck(
      related >= testCase.expect.minRelatedQueries,
      `related ok (${related})`,
      `related fail (${related})`,
    );
  } else if (strict) {
    runCheck(related >= 2, `relatedStrict ok (${related})`, `relatedStrict fail (${related})`);
  }

  if (typeof testCase.expect.minInternalAnchors === "number") {
    runCheck(
      anchors >= testCase.expect.minInternalAnchors,
      `anchors ok (${anchors})`,
      `anchors fail (${anchors})`,
    );
  } else if (strict) {
    runCheck(anchors >= 2, `anchorsStrict ok (${anchors})`, `anchorsStrict fail (${anchors})`);
  }

  if (typeof testCase.expect.minIntroLen === "number") {
    runCheck(
      intro.length >= testCase.expect.minIntroLen,
      `introLen ok (${intro.length})`,
      `introLen fail (${intro.length})`,
    );
  } else if (strict) {
    runCheck(intro.length >= 45, `introStrict ok (${intro.length})`, `introStrict fail (${intro.length})`);
  }

  if (typeof testCase.expect.minConversionNudges === "number") {
    runCheck(
      nudges >= testCase.expect.minConversionNudges,
      `nudges ok (${nudges})`,
      `nudges fail (${nudges})`,
    );
  } else if (strict) {
    runCheck(nudges >= 2, `nudgesStrict ok (${nudges})`, `nudgesStrict fail (${nudges})`);
  }

  if (typeof testCase.expect.minFreshnessNotes === "number") {
    runCheck(fresh >= testCase.expect.minFreshnessNotes, `fresh ok (${fresh})`, `fresh fail (${fresh})`);
  } else if (strict) {
    runCheck(fresh >= 2, `freshStrict ok (${fresh})`, `freshStrict fail (${fresh})`);
  }

  const needDupNotHigh = testCase.expect.duplicateRiskNotHigh === true || strict;
  if (needDupNotHigh) {
    runCheck(dup !== "high", `duplicateRisk ok (${dup || "?"})`, `duplicateRisk fail (${dup || "?"})`);
  }

  const minLex = testCase.expect.minLexicalScore ?? (strict ? 0.35 : undefined);
  if (typeof minLex === "number") {
    const lex = seoLexicalScore(testCase.query, { title, metaDescription: meta, h1, intro });
    runCheck(lex >= minLex, `seoLexical ok (${lex.toFixed(3)})`, `seoLexical fail (${lex.toFixed(3)})`);
  }

  const score = totalChecks === 0 ? 0 : passCount / totalChecks;
  const ok = totalChecks > 0 && score >= okThreshold;
  return {
    id: testCase.id,
    type: "seo",
    ok,
    score,
    weightedScore: caseWeight * score,
    caseWeight,
    latencyMs: res.elapsed,
    checks,
    meta: testCase.meta,
    facets,
  };
}

function buildMultivariate(results: CaseResult[]): Record<string, Record<string, FacetAgg>> {
  const dims: Record<string, Record<string, FacetAgg>> = {};
  for (const r of results) {
    for (const [dim, val] of Object.entries(r.facets)) {
      if (!dims[dim]) dims[dim] = {};
      bumpFacet(dims[dim]!, val, r.ok, r.score, r.caseWeight);
    }
  }
  return dims;
}

function finalizeFacets(raw: Record<string, Record<string, FacetAgg>>) {
  const out: Record<string, Record<string, { n: number; passed: number; passRate: number; avgScore: number }>> = {};
  for (const [dim, cells] of Object.entries(raw)) {
    out[dim] = {};
    for (const [val, agg] of Object.entries(cells)) {
      out[dim][val] = {
        n: agg.total,
        passed: agg.passed,
        passRate: agg.total ? agg.passed / agg.total : 0,
        avgScore: agg.total ? agg.sumScore / agg.total : 0,
      };
    }
  }
  return out;
}

async function runVariant(
  baseUrl: string,
  cases: EvalCase[],
  model: string,
  okThreshold: number,
  strict: boolean,
): Promise<VariantReport> {
  const results: CaseResult[] = [];
  for (const c of cases) {
    if (c.type === "suggest") {
      results.push(await evalSuggest(baseUrl, c, model, okThreshold, strict));
    } else {
      results.push(await evalSeo(baseUrl, c, model, okThreshold, strict));
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const weights = results.map((r) => r.caseWeight);
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const weightedAvgScore = results.reduce((s, r) => s + r.weightedScore, 0) / sumW;
  const latencies = results.map((r) => r.latencyMs);

  return {
    model,
    total: results.length,
    passed,
    passRate: results.length ? passed / results.length : 0,
    avgScore: mean(results.map((r) => r.score)),
    weightedAvgScore,
    avgLatencyMs: mean(latencies),
    medianLatencyMs: median(latencies),
    latencyStdMs: stdSample(latencies),
    wilson95PassRate: wilson95(passed, results.length),
    results,
  };
}

async function resolveInputPath(root: string): Promise<string> {
  const primary = path.join(root, "eval", "queries.jsonl");
  try {
    await readFile(primary, "utf8");
    return primary;
  } catch {
    return path.join(root, "eval", "queries.template.jsonl");
  }
}

async function main() {
  const { strict } = parseArgs();
  const root = process.cwd();
  const baseUrl = process.env.EVAL_BASE_URL ?? "http://localhost:3000";
  const models = (process.env.EVAL_MODELS ?? "gpt-4o-mini,gpt-4o")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const okThreshold = parseOkThreshold();
  const gateMin = parseGateMin();
  const experimentId = process.env.EVAL_EXPERIMENT_ID?.trim() || "default";

  const inputPath = await resolveInputPath(root);
  const content = await readFile(inputPath, "utf8");
  const cases = parseJsonl(content);

  const reports: VariantReport[] = [];
  for (const model of models) {
    reports.push(await runVariant(baseUrl, cases, model, okThreshold, strict));
  }

  const winner = [...reports].sort(
    (a, b) => b.weightedAvgScore - a.weightedAvgScore || a.avgLatencyMs - b.avgLatencyMs,
  )[0];

  let pairedComparison: Record<string, unknown> | undefined;
  if (reports.length === 2) {
    const [a, b] = reports;
    const okA = a.results.map((r) => r.ok);
    const okB = b.results.map((r) => r.ok);
    const m = mcnemarPaired(okA, okB);
    pairedComparison = {
      modelA: a.model,
      modelB: b.model,
      discordantAB: m.b,
      discordantBA: m.c,
      mcnemarChi2: m.chi2,
      mcnemarPApprox: m.chi2 !== null ? chi2PApprox(m.chi2) : null,
      note: m.note,
      prefer:
        m.b === m.c
          ? "tie"
          : m.b < m.c
            ? b.model
            : a.model,
    };
  }

  const multivariateByModel: Record<string, Record<string, Record<string, { n: number; passed: number; passRate: number; avgScore: number }>>> = {};
  for (const r of reports) {
    multivariateByModel[r.model] = finalizeFacets(buildMultivariate(r.results));
  }

  const gateResults = reports.map((r) => ({
    model: r.model,
    meetsPassRateGate: r.passRate >= gateMin,
    meetsWilsonLowerGate: r.wilson95PassRate.low >= gateMin - 0.05,
  }));

  const summary = {
    generatedAt: new Date().toISOString(),
    experimentId,
    baseUrl,
    models,
    inputPath,
    strict,
    standards: {
      okThreshold,
      aggregatePassRateGate: gateMin,
      description:
        "Per-case ok requires weighted check fraction >= okThreshold. --strict adds lexical, duplicate-risk, and density checks.",
    },
    totalCases: cases.length,
    winner: winner?.model,
    statistics: {
      pairedComparison,
      gateResults,
    },
    multivariate: {
      byModelAndFacet: multivariateByModel,
    },
    reports,
  };

  const outPath = path.join(root, "eval", "latest-report.json");
  await writeFile(outPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("Evaluation complete.");
  console.log(`Input: ${inputPath}`);
  console.log(`Cases: ${cases.length} | strict=${strict} | okThreshold=${okThreshold}`);
  for (const r of reports) {
    const w = r.wilson95PassRate;
    console.log(
      `${r.model}: pass ${r.passed}/${r.total} (${(r.passRate * 100).toFixed(1)}%), Wilson95=[${(w.low * 100).toFixed(1)}%,${(w.high * 100).toFixed(1)}%] weightedAvgScore=${r.weightedAvgScore.toFixed(3)} latency mean=${Math.round(r.avgLatencyMs)}ms std=${Math.round(r.latencyStdMs)}`,
    );
  }
  if (pairedComparison && typeof pairedComparison.mcnemarChi2 === "number") {
    console.log(
      `Paired (McNemar): chi2=${pairedComparison.mcnemarChi2} pApprox=${pairedComparison.mcnemarPApprox} prefer=${String(pairedComparison.prefer)}`,
    );
  }
  if (winner) console.log(`Winner (weighted score): ${winner.model}`);
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
