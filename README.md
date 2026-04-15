# Elfster AI prototype

Locked stack: **TypeScript**, **Next.js (App Router)**, **Vercel**, **Vercel AI SDK**, **OpenAI GPT-4o**, **Neon Postgres + Prisma**, **Upstash Redis** (optional rate limit), secrets in **Vercel** (production) and a **gitignored `.env`** locally.

## Prerequisites

- **Node.js 20+** and npm
- Accounts (browser, one-time): **Neon**, **OpenAI** (API keys and billing are separate from **ChatGPT Plus**), **Upstash** (optional but recommended), **Vercel** when you deploy

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment template to **`.env`** in the project root and fill in real values:

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux use `cp .env.example .env`.

   **Why `.env`:** the Prisma CLI (`db push`, `migrate`, `seed`) loads **`.env`** by default. It does **not** read `.env.local`, so putting `DATABASE_URL` only in `.env.local` causes `P1012 Environment variable not found: DATABASE_URL`. Next.js also loads `.env`, so one file works for both.

   **Upstash:** optional. Leave `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` empty until you create a Redis database in Upstash; the app runs without rate limiting.

3. Push the Prisma schema and seed sample gifts (requires `DATABASE_URL`):

   ```bash
   npx prisma db push
   npm run db:seed
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000). Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health).

6. Optional quality checks:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```

7. Optional model evaluation (A/B, statistics, multivariate facets):

   ```bash
   copy eval\queries.template.jsonl eval\queries.jsonl
   npm run eval
   npm run eval:strict
   ```

   This writes `eval/latest-report.json` with pass rates, **Wilson 95% intervals**, weighted scores, **McNemar paired comparison** when two models are configured, latency distribution, and facet tables by case metadata. See `eval/README.md` for environment variables (`EVAL_OK_THRESHOLD`, `EVAL_GATE_MIN_PASS_RATE`, `EVAL_EXPERIMENT_ID`, and more).

## Upgraded v2 endpoints

- `POST /api/suggest` - core gift recommendation flow (intent -> filter -> rank -> explanations)
- `POST /api/seo/brief` - upgraded SEO/discovery brief generator aligned to the 10 business problems
- `GET /api/seo/briefs` - list recent saved SEO briefs
- `POST /api/seo/briefs` - save a generated brief for review and reuse
- `PATCH /api/seo/briefs` - update status/owner/reviewer notes (`draft|review|approved|published`)
- `GET /api/seo/briefs/[id]/export` - export publish-ready markdown for a saved brief

Example payload for `/api/seo/brief`:

```json
{
  "query": "gift for remote coworker under $30 who likes coffee",
  "locale": "en-US",
  "audienceHint": "office gift shoppers"
}
```

## Project layout

- `docs/` - product and task docs
- `prisma/` - schema + seed
- `src/app/` - UI and route handlers (`/api/suggest`, `/api/health`, `/api/seo/brief`, `/api/seo/briefs`)
- `src/lib/` - Prisma client, Redis helper, AI model wiring, Zod schemas, SEO problem maps

## Public deploy (Vercel): share a link with anyone

Your app on `localhost:3000` only runs on your computer. To give **planet Earth** a normal `https://...` link, host it on the internet. For this Next.js stack, **Vercel** is the path of least resistance (same company family as Next.js, zero server config, HTTPS included).

If this repo is only on your machine so far, either run **`npm run github:publish`** (after `GITHUB_TOKEN` + `GITHUB_OWNER` in `.env`) or follow **`docs/GITHUB_FIRST_PUSH.md`** for manual steps.

### 1. Put the code on GitHub (or GitLab / Bitbucket)

Vercel deploys from a **git** remote.

- If the folder is not a git repo yet:

  ```bash
  git init
  git add .
  git commit -m "Initial prototype"
  ```

- Create a new empty repository on **GitHub**, then connect and push (replace `YOUR_USER` / `YOUR_REPO`):

  ```bash
  git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
  git branch -M main
  git push -u origin main
  ```

**Important:** keep `.env` **gitignored** (it already should be). Never commit real API keys.

### 2. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub login is fine).
2. **Add New** → **Project** → **Import** your repository.
3. Framework: Vercel should detect **Next.js**. Leave defaults unless you know you need overrides.
4. **Root directory:** project root (where `package.json` lives).
5. Click **Deploy** once (it may fail until env vars exist; that is OK). Then open **Project → Settings → Environment Variables**.

### 3. Set production environment variables

Add these for **Production** (and Preview if you want preview deployments to work too):

| Name | What to paste |
|------|----------------|
| `DATABASE_URL` | Your **Neon** Postgres URL. Prefer the **pooled** connection string from the Neon dashboard (serverless-friendly). Must include `?sslmode=require` if Neon shows it. |
| `OPENAI_API_KEY` | Your OpenAI **secret** key (`sk-...`). Billing is usage-based; a public app will spend money when people use AI features. |
| `OPENAI_SUGGESTION_MODEL` | Optional, e.g. `gpt-4o-mini` to control cost. |
| `OPENAI_SEO_MODEL` | Optional, e.g. `gpt-4o-mini`. |
| `UPSTASH_REDIS_REST_URL` | Optional but **recommended** for a public link so rate limiting can reduce abuse. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional; pair with Upstash URL. |

Save, then trigger **Redeploy** (Deployments → … on latest → Redeploy) so the new env vars apply.

### 4. Create tables and seed data on the *same* database

Production uses the **same** Neon database you pointed `DATABASE_URL` at. Prisma does **not** auto-run migrations on every visitor request; you run schema + seed **once** from your machine (or CI) against that URL.

**Option A (simple):** temporarily put the production `DATABASE_URL` in your local `.env`, then:

```bash
npx prisma db push
npm run db:seed
```

Then restore your local DB URL if you use a separate dev database.

**Option B:** use a Neon branch URL for production only and keep dev on another branch.

Without `db push`, API routes that hit Prisma can error. Without `db:seed`, the gift catalog may be empty until you add real data.

### 5. Your public URL

After a successful deploy, Vercel shows something like:

- `https://YOUR_PROJECT.vercel.app`

That URL serves the **same** app as localhost: quick checks:

- `https://YOUR_PROJECT.vercel.app/api/health`
- Open `/` for gift suggest UI and `/seo` for SEO tools.

You can add a **custom domain** later under Project → Settings → Domains.

### 6. Cost and abuse (read this if the link is truly public)

Anyone who can open the site can trigger **OpenAI** and **Neon** usage. That can rack up spend or exhaust free tiers.

Mitigations already in the code: optional **Upstash** rate limiting on `/api/suggest`. Strongly recommended for a public demo.

Extra options: use **Vercel Deployment Protection** or keep the repo private and only share the URL with trusted testers; cap models to **`gpt-4o-mini`**; set OpenAI [usage limits](https://platform.openai.com/account/limits) in the OpenAI dashboard.

### 7. After deploy

- Point `EVAL_BASE_URL` at your public URL if you run `npm run eval` against production (careful: costs).
- Continue product work in `docs/TASKS.md` and `docs/SEO_DISCOVERY_TASKS.md`.
