# SEO discovery implementation tasks (v2)

This checklist executes the upgraded 10-problem business version.

## Phase 1 - Foundation

- [x] Define 10 SEO/discovery business problems in one source.
- [x] Create a dedicated structured schema for SEO page briefs.
- [x] Add a dedicated SEO API route (`/api/seo/brief`).
- [x] Reuse shared OpenAI guards for cleaner error handling.

## Phase 2 - Content intelligence

- [x] Generate title/meta/H1/intro/sections/FAQs from long-tail input.
- [x] Add duplicate risk scoring (`low`/`medium`/`high`).
- [x] Add internal link anchor suggestions.
- [x] Add freshness notes and related query expansion.
- [x] Add conversion nudge suggestions.

## Phase 3 - Product integration

- [x] Build a simple UI page to call `/api/seo/brief` and view/edit output.
- [x] Add save brief support in the database for review workflow.
- [x] Connect brief output to publish-ready markdown export (`/api/seo/briefs/[id]/export`).

## Phase 4 - Quality controls

- [x] Add brand voice guardrails and banned claims list.
- [x] Add quality flags (meta length/title length/faq-section minimums/duplicate risk) on saved briefs.
- [x] Add fallback behavior when AI output is incomplete.

## Phase 5 - Growth loop

- [x] Track page metrics (traffic, click-through, conversion proxy).
- [x] Mark low performers and regenerate briefs on schedule.
- [x] Create priority queues for seasonal refreshes.

## Current status

The core v2 capability is live:
- structured SEO brief generation
- explicit mapping to the 10 business problems
- reusable error handling and model configuration
- `/seo` UI page to generate and inspect briefs
- saved brief API + history panel in `/seo`
- review workflow controls (status, owner, reviewer notes)
- publish-ready markdown export endpoint
- SEO brief retry on structural misses plus programmatic fill (`incompleteFallback` + `structuralWarnings` in API/UI)
- Growth loop: metric counters on `SavedSeoBrief`, `POST /api/seo/briefs/[id]/metrics`, `GET /api/seo/insights` (low performers + refresh queue), priority and seasonal tags on PATCH, `/seo` UI

Next highest-impact step: **auth + real analytics wiring**, or deepen retrieval for gifts.
