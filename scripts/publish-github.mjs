/**
 * One-shot: create GitHub repo (if missing) and push `main`.
 *
 * Prerequisites:
 * - Git repo with commits on branch `main`
 * - In `.env` (or environment): GITHUB_TOKEN, GITHUB_OWNER
 * - Optional: GITHUB_REPO (defaults to elfster-ai-prototype)
 *
 * Token: https://github.com/settings/tokens — classic PAT with `repo`
 *   or fine-grained with "Repository administration" + Contents read/write on the target repo.
 *
 * Usage: node scripts/publish-github.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function loadDotEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function gitBin() {
  if (process.platform === "win32") {
    const p = "C:\\Program Files\\Git\\mingw64\\bin\\git.exe";
    if (existsSync(p)) return p;
  }
  return "git";
}

function runGit(args, opts = {}) {
  execFileSync(gitBin(), args, { stdio: "inherit", ...opts });
}

loadDotEnv();

const token = process.env.GITHUB_TOKEN?.trim();
const owner = process.env.GITHUB_OWNER?.trim();
const repo = process.env.GITHUB_REPO?.trim() || "elfster-ai-prototype";

if (!token || !owner) {
  console.error(
    "Missing GITHUB_TOKEN or GITHUB_OWNER.\nAdd them to your gitignored `.env`, then run:\n  npm run github:publish\n",
  );
  process.exit(1);
}

if (token.length < 20) {
  console.error("GITHUB_TOKEN looks too short.");
  process.exit(1);
}

const api = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

console.log(`Checking / creating repo ${owner}/${repo} ...`);

const createRes = await fetch(`${api}/user/repos`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: repo,
    private: false,
    auto_init: false,
    description: "Elfster AI prototype — Next.js + Prisma + OpenAI",
  }),
});

if (createRes.status === 201) {
  console.log("Created new repository on GitHub.");
} else if (createRes.status === 422) {
  const j = await createRes.json().catch(() => ({}));
  if (String(j.message || "").toLowerCase().includes("already exists")) {
    console.log("Repository already exists; continuing to push.");
  } else {
    console.error("GitHub API 422:", JSON.stringify(j, null, 2));
    process.exit(1);
  }
} else if (!createRes.ok) {
  const text = await createRes.text();
  console.error(`GitHub API error ${createRes.status}:`, text.slice(0, 500));
  process.exit(1);
}

const authedRemote = `https://${encodeURIComponent(owner)}:${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`;
const cleanRemote = `https://github.com/${owner}/${repo}.git`;

try {
  runGit(["remote", "remove", "origin"], { stdio: "pipe" });
} catch {
  /* none */
}

runGit(["remote", "add", "origin", authedRemote]);
console.log("Pushing branch main ...");
try {
  runGit(["push", "-u", "origin", "main"]);
} finally {
  runGit(["remote", "set-url", "origin", cleanRemote]);
  console.log("Remote URL scrubbed (token removed from saved origin).");
}

console.log(`Done. Open https://github.com/${owner}/${repo}`);
