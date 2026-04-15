# Architecture Cheat Sheet (2-minute explanation)

Use this page when you need to explain the product quickly to teammates, advisors, or investors.

## What this product is

This is a public AI gifting prototype with two connected experiences:

1. **Gift assistant** (`/`)  
   User types a gift question in plain English, and the app returns matched gift ideas from a real catalog plus AI explanations.

2. **SEO discovery lab** (`/seo`)  
   User types a long-tail search query, and the app generates a structured SEO brief that can be reviewed, approved, and exported.

## The 4 engines

1. **Recommendation engine**
   - Reads messy gift questions
   - Parses structured intent (budget, recipient, interests, occasion)
   - Filters/ranks real catalog items from the database
   - Writes friendly explanations

2. **SEO brief engine**
   - Converts long-tail query into structured content plan
   - Produces title, meta, H1, intro, sections, FAQs, links, freshness, and conversion ideas
   - Includes duplicate-risk signal

3. **Workflow + quality engine**
   - Saves briefs for team review
   - Supports status flow: `draft -> review -> approved -> published`
   - Enforces quality checks and brand guardrails before approve/publish
   - Exports publish-ready markdown

4. **Growth + learning engine**
   - Tracks metric proxies (impressions, clicks, conversions)
   - Flags low performers
   - Builds a refresh queue (priority, seasonal tags, stale pages)
   - Runs model evaluation with statistics

## Main request flows

## A) Gift suggestion flow

1. UI sends `POST /api/suggest` with free-text query.
2. AI parses intent (structured wish schema).
3. Prisma queries `Gift` table.
4. App ranks top matches.
5. AI writes explanations for top gifts.
6. API responds with `wish + results`.

## B) SEO brief flow

1. UI sends `POST /api/seo/brief`.
2. AI returns structured brief object.
3. Server checks structural completeness.
4. If incomplete: retry once, then fallback normalization.
5. UI displays brief and allows save.

## C) Review/publish flow

1. UI saves with `POST /api/seo/briefs`.
2. Team updates status/notes via `PATCH /api/seo/briefs`.
3. On approve/publish, server applies guardrails + quality gates.
4. Export via `GET /api/seo/briefs/[id]/export`.

## D) Growth flow

1. Add metric deltas with `POST /api/seo/briefs/[id]/metrics`.
2. Read insights via `GET /api/seo/insights`.
3. Refresh queue is generated from priority + low CTR + staleness + seasonal tag.

## Database tables (plain language)

## `Gift`

Catalog of recommendable items.

- `id` - unique gift id
- `title` - gift name
- `description` - gift details
- `priceCents` - budget filter source
- `tags[]` - interests/categories for matching
- `audience` - who it is for (optional)
- `occasion` - when to give it (optional)
- `createdAt`, `updatedAt` - timestamps

## `SavedSeoBrief`

Persistent SEO operations record.

- `id`, `query`, `locale`, `audienceHint`
- `status` (`draft/review/approved/published`)
- `owner`, `reviewerNotes`
- `briefJson` (full structured brief)
- `qualityJson` (quality score + flags)
- `publishedAt`
- `impressions`, `clicks`, `conversions`
- `refreshPriority`, `seasonalTag`, `metricsUpdatedAt`
- `createdAt`, `updatedAt`

## Problem coverage mapping (simple)

- **Core SEO problem coverage** lives mostly in `briefJson` (it contains intent, relevance, FAQ depth, links, freshness, conversion, duplicate risk).
- **Quality/trust problems** are handled by `qualityJson`, `status`, and guardrail checks during `PATCH`.
- **Growth-loop problems** are handled by `impressions/clicks/conversions`, `refreshPriority`, `seasonalTag`, and `metricsUpdatedAt`.

This is a many-to-many mapping, not one-column-per-problem.

## API surface (most important)

- `POST /api/suggest`
- `POST /api/seo/brief`
- `GET /api/seo/briefs`
- `POST /api/seo/briefs`
- `PATCH /api/seo/briefs`
- `GET /api/seo/briefs/[id]/export`
- `POST /api/seo/briefs/[id]/metrics`
- `GET /api/seo/insights`
- `GET /api/health`

## Deployment + infra

- Frontend/API: **Next.js on Vercel**
- DB: **Neon Postgres**
- ORM: **Prisma**
- AI: **Vercel AI SDK + OpenAI**
- Optional rate limit: **Upstash Redis**

## Current maturity (honest)

Strong prototype maturity:
- Public URL, real DB, real model calls, review workflow, guardrails, growth loop, statistical eval.

Not yet full production at massive scale:
- No auth/roles, no full analytics pipeline, no enterprise governance, no large-scale retrieval stack.

## 30-second pitch

"We built an AI gifting assistant plus SEO discovery ops system. It turns natural language into structured gift matches and structured SEO briefs, then adds review gates, publish workflow, growth metrics, and statistical model evaluation. It is public, real-stack, and ready for controlled demo traffic."
