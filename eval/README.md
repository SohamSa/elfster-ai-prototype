# Evaluation harness (experimental + statistical)

This folder benchmarks the two AI surfaces (`POST /api/suggest`, `POST /api/seo/brief`) with **stricter rubrics**, **weighted cases**, **multivariate facet tables**, and **classical statistics** (Wilson intervals, paired McNemar for two models).

It is **not** a substitute for a full ML accuracy study: there is no held-out human labels file, no fine-tuned classifier, and no deep learning stack here. Instead you get **reproducible rubric + lexical-alignment metrics** suitable for regression testing and model A/B comparisons.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Case + result shapes (metadata, weights, checks). |
| `stats.ts` | Wilson 95% interval, latency mean/std/median, McNemar paired test. |
| `heuristics.ts` | Zero-shot **lexical recall** of query tokens into outputs (cheap "accuracy proxy"). |
| `run.ts` | Orchestration, multivariate aggregation, `latest-report.json`. |
| `queries.template.jsonl` | Large, metadata-rich suite (copy to `queries.jsonl`). |
| `queries.jsonl` | Active suite (gitignored if you choose; this repo ships a default copy). |
| `latest-report.json` | Generated report. |

## Run

1. `npm run dev` (or set `EVAL_BASE_URL` to a deployed URL).
2. `npm run eval` — default thresholds are **stricter** than early prototypes (`EVAL_OK_THRESHOLD` defaults to **0.85** per case pass).
3. `npm run eval:strict` — adds extra SEO density checks, duplicate-risk pressure, lexical floors, and suggest title hygiene.

If `eval/queries.jsonl` is missing, the runner falls back to `queries.template.jsonl`.

## Environment variables

| Variable | Meaning |
|----------|---------|
| `EVAL_BASE_URL` | Default `http://localhost:3000` |
| `EVAL_MODELS` | Comma-separated OpenAI model ids, e.g. `gpt-4o-mini,gpt-4o` |
| `EVAL_OK_THRESHOLD` | Fraction of per-case checks required for `ok` (default `0.85`) |
| `EVAL_GATE_MIN_PASS_RATE` | Pass-rate floor for `statistics.gateResults` (default `0.8`) |
| `EVAL_STRICT` | `1` / `true` same as CLI `--strict` |
| `EVAL_EXPERIMENT_ID` | Label stored in the JSON report for multivariate runs |

## What the report contains

- **Per model**: pass count, pass rate, **Wilson 95%** interval on pass rate, mean/median/std latency, simple average score and **weight-adjusted** average score.
- **Paired statistics** (only when exactly **two** models): McNemar discordant counts, chi-square statistic, coarse **pApprox** from the chi-square critical values, and a `prefer` hint.
- **Multivariate**: nested tables `facet -> value -> { n, passed, passRate, avgScore }` for dimensions such as `segment`, `difficulty`, `caseType`, `intentSurface`, `localeRegion`, `tags`.
- **Case metadata** echoed per row for downstream analysis in your BI tool of choice.

## Accuracy and "ML"

- **Rubrics + lexical recall** approximate product quality; they can be wrong when the model is creative but uses synonyms not in the query.
- For **true** accuracy metrics you still need labeled judgments (human or LLM-as-judge with frozen prompts), calibration, and enough volume that Wilson intervals narrow. This harness exports structured JSON to feed that workflow.

## Multivariate testing

Each case carries `meta` (segment, difficulty, surfaces, tags, weight). The runner expands every result into facet dimensions so you can compare models **within** slices (for example `difficulty=hard` only) using the JSON in `latest-report.json`.
