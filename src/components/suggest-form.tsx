"use client";

import { useState } from "react";
import { parseSuggestSuccess, SuggestResults } from "@/components/suggest-results";

export function SuggestForm() {
  const [query, setQuery] = useState("Gift for coworker under $25");
  const [includeSeo, setIncludeSeo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ReturnType<typeof parseSuggestSuccess> | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setParsed(null);
    setRawFallback(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, includeSeo }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : `Request failed (${res.status})`,
        );
        return;
      }
      const success = parseSuggestSuccess(body);
      if (success.ok) {
        setParsed(success);
        return;
      }
      setRawFallback(JSON.stringify(body, null, 2));
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="query">Your gift question</label>
        <textarea
          id="query"
          name="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Example: "gift for coworker under $25"'
        />
        <p className="hint">
          Try budget, relationship (coworker, friend), hobbies, or occasion — plain English is fine.
        </p>
        <div className="row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeSeo}
              onChange={(e) => setIncludeSeo(e.target.checked)}
            />
            Include SEO-style title &amp; description
          </label>
        </div>
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Thinking…" : "Suggest gifts"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>

      {parsed?.ok ? (
        <SuggestResults
          wish={parsed.wish}
          results={parsed.results}
          message={parsed.message}
          includeSeo={includeSeo}
        />
      ) : null}
      {rawFallback ? (
        <pre className="card raw-fallback" aria-label="Raw response">
          {rawFallback}
        </pre>
      ) : null}
    </>
  );
}
