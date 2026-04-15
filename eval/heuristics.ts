const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
  "was",
  "has",
  "have",
  "who",
  "under",
  "gift",
  "gifts",
  "ideas",
  "best",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Recall of query tokens found in corpus (0-1). */
export function queryTokenRecall(query: string, corpus: string): number {
  const q = tokenize(query);
  if (!q.length) return 1;
  const cset = new Set(tokenize(corpus));
  let hit = 0;
  for (const t of q) {
    if (cset.has(t)) hit += 1;
  }
  return hit / q.length;
}

export function suggestLexicalScore(query: string, results: Array<{ gift?: { title?: string; description?: string } }>): number {
  const corpus = (results ?? [])
    .map((r) => `${r?.gift?.title ?? ""} ${r?.gift?.description ?? ""}`)
    .join(" ");
  return queryTokenRecall(query, corpus);
}

export function seoLexicalScore(
  query: string,
  brief: {
    title?: string;
    metaDescription?: string;
    h1?: string;
    intro?: string;
  },
): number {
  const corpus = `${brief.title ?? ""} ${brief.metaDescription ?? ""} ${brief.h1 ?? ""} ${brief.intro ?? ""}`;
  return queryTokenRecall(query, corpus);
}
