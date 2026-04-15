"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SavedSeoBriefItem,
  SavedSeoBriefListResponse,
  SeoBriefStatus,
  SeoBriefResponse,
  SeoInsightsResponse,
} from "@/lib/types/seo-discovery";
import { seoBriefSchema } from "@/lib/schemas/seo-discovery";
import { parseSavedBriefItemFromApi } from "@/lib/seo/map-saved-brief";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function looksLikeSeoBriefResponse(v: unknown): v is SeoBriefResponse {
  if (!isRecord(v)) return false;
  if (v.ok !== true) return false;
  if (!isRecord(v.input)) return false;
  if (typeof v.input.query !== "string") return false;
  if (typeof v.input.locale !== "string") return false;
  if (!Array.isArray(v.businessProblemsCovered)) return false;
  if (!isRecord(v.brief)) return false;
  if (typeof v.brief.title !== "string" || typeof v.brief.metaDescription !== "string") return false;
  if (!Array.isArray(v.brief.sections) || !Array.isArray(v.brief.faqs)) return false;
  return true;
}

function looksLikeSavedList(v: unknown): v is SavedSeoBriefListResponse {
  if (!isRecord(v) || v.ok !== true || !Array.isArray(v.items)) return false;
  return true;
}

function looksLikeSeoInsights(v: unknown): v is SeoInsightsResponse {
  if (!isRecord(v) || v.ok !== true) return false;
  if (!Array.isArray(v.lowPerformers) || !Array.isArray(v.refreshQueue)) return false;
  if (!isRecord(v.thresholds)) return false;
  if (typeof v.thresholds.minImpressions !== "number") return false;
  if (typeof v.thresholds.maxCtr !== "number") return false;
  if (typeof v.thresholds.stalePublishedDays !== "number") return false;
  return true;
}

const statuses: SeoBriefStatus[] = ["draft", "review", "approved", "published"];

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}

export function SeoBriefForm() {
  const [query, setQuery] = useState("gift for remote coworker under $30 who likes coffee");
  const [locale, setLocale] = useState("en-US");
  const [audienceHint, setAudienceHint] = useState("office gift shoppers");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SeoBriefResponse | null>(null);
  const [history, setHistory] = useState<SavedSeoBriefItem[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | SeoBriefStatus>("all");
  const [historyQueryFilter, setHistoryQueryFilter] = useState("");
  const [ownerEdit, setOwnerEdit] = useState("");
  const [reviewerNotesEdit, setReviewerNotesEdit] = useState("");
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const [reviewViolations, setReviewViolations] = useState<string[] | null>(null);
  const [insights, setInsights] = useState<SeoInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [metricsPosting, setMetricsPosting] = useState(false);
  const [seasonalTagEdit, setSeasonalTagEdit] = useState("");
  const [priorityEdit, setPriorityEdit] = useState("0");

  const quickCopy = useMemo(() => {
    if (!result) return "";
    return [
      `Title: ${result.brief.title}`,
      `Meta: ${result.brief.metaDescription}`,
      `H1: ${result.brief.h1}`,
      "",
      `Intro: ${result.brief.intro}`,
    ].join("\n");
  }, [result]);

  const selectedSaved = history.find((x) => x.id === selectedSavedId) ?? null;

  const loadHistory = useCallback(async function loadHistoryImpl() {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyStatusFilter !== "all") params.set("status", historyStatusFilter);
      if (historyQueryFilter.trim()) params.set("q", historyQueryFilter.trim());
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/seo/briefs${suffix}`, { cache: "no-store" });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok || !looksLikeSavedList(body)) return;
      const normalized: SavedSeoBriefItem[] = body.items
        .map((x) => parseSavedBriefItemFromApi(x))
        .filter((x): x is SavedSeoBriefItem => Boolean(x));
      setHistory(normalized);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyQueryFilter, historyStatusFilter]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!selectedSavedId) return;
    const row = history.find((h) => h.id === selectedSavedId);
    if (!row) return;
    setSeasonalTagEdit(row.seasonalTag ?? "");
    setPriorityEdit(String(row.refreshPriority));
  }, [selectedSavedId, history]);

  async function loadInsights() {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/seo/insights", { cache: "no-store" });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok || !looksLikeSeoInsights(body)) {
        setInsights(null);
        return;
      }
      const lowPerformers = body.lowPerformers
        .map((x) => parseSavedBriefItemFromApi(x))
        .filter((x): x is SavedSeoBriefItem => Boolean(x));
      const refreshQueue = body.refreshQueue
        .map((x) => parseSavedBriefItemFromApi(x))
        .filter((x): x is SavedSeoBriefItem => Boolean(x));
      setInsights({
        ok: true,
        lowPerformers,
        refreshQueue,
        thresholds: body.thresholds,
      });
    } finally {
      setInsightsLoading(false);
    }
  }

  async function saveGrowthFields() {
    if (!selectedSaved) return;
    const pr = Number.parseInt(priorityEdit, 10);
    const priority = Number.isFinite(pr) && pr >= 0 && pr <= 3 ? pr : 0;
    setUpdating(true);
    setError(null);
    setReviewViolations(null);
    try {
      const res = await fetch("/api/seo/briefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSaved.id,
          status: selectedSaved.status,
          refreshPriority: priority,
          seasonalTag: seasonalTagEdit.trim() === "" ? null : seasonalTagEdit.trim(),
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; violations?: unknown } | null;
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : `Update failed (${res.status})`);
        return;
      }
      await loadHistory();
      void loadInsights();
      setSaveMessage("Saved growth queue fields.");
    } catch {
      setError("Network error while updating.");
    } finally {
      setUpdating(false);
    }
  }

  async function postMetric(kind: "impressions" | "clicks" | "conversions") {
    if (!selectedSaved) return;
    setMetricsPosting(true);
    setError(null);
    try {
      const payload =
        kind === "impressions"
          ? { impressionsDelta: 25 }
          : kind === "clicks"
            ? { clicksDelta: 1 }
            : { conversionsDelta: 1 };
      const res = await fetch(`/api/seo/briefs/${selectedSaved.id}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : `Metrics update failed (${res.status})`);
        return;
      }
      await loadHistory();
      void loadInsights();
      setSaveMessage("Recorded metric proxy.");
    } catch {
      setError("Network error while recording metrics.");
    } finally {
      setMetricsPosting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReviewViolations(null);
    setSaveMessage(null);
    setResult(null);
    setRawFallback(null);
    try {
      const res = await fetch("/api/seo/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          locale,
          audienceHint: audienceHint.trim() || undefined,
        }),
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
      if (looksLikeSeoBriefResponse(body)) {
        setResult(body);
        return;
      }
      setRawFallback(JSON.stringify(body, null, 2));
    } catch {
      setError("Network error while generating SEO brief.");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveCurrent() {
    if (!result) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    setReviewViolations(null);
    try {
      const res = await fetch("/api/seo/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: result.input.query,
          locale: result.input.locale,
          audienceHint: result.input.audienceHint,
          brief: result.brief,
        }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : `Save failed (${res.status})`,
        );
        return;
      }
      setSaveMessage("Saved to history.");
      await loadHistory();
      void loadInsights();
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  function openFromHistory(item: SavedSeoBriefItem) {
    setResult({
      ok: true,
      input: {
        query: item.query,
        locale: item.locale,
        audienceHint: item.audienceHint,
      },
      brief: item.brief,
      businessProblemsCovered: [],
    });
    setQuery(item.query);
    setLocale(item.locale);
    setAudienceHint(item.audienceHint ?? "");
    setSelectedSavedId(item.id);
    setOwnerEdit(item.owner ?? "");
    setReviewerNotesEdit(item.reviewerNotes ?? "");
    setSaveMessage(`Loaded saved brief from ${new Date(item.createdAt).toLocaleString()}.`);
    setReviewViolations(null);
    setError(null);
  }

  async function updateSelected(status?: SeoBriefStatus) {
    if (!selectedSaved) return;
    setUpdating(true);
    setError(null);
    setReviewViolations(null);
    try {
      const res = await fetch("/api/seo/briefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSaved.id,
          status: status ?? selectedSaved.status,
          owner: ownerEdit.trim() || undefined,
          reviewerNotes: reviewerNotesEdit.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        violations?: unknown;
      } | null;
      if (!res.ok) {
        const violations =
          body && Array.isArray(body.violations)
            ? body.violations.filter((x): x is string => typeof x === "string")
            : [];
        setReviewViolations(violations.length > 0 ? violations : null);
        setError(typeof body?.error === "string" ? body.error : `Update failed (${res.status})`);
        return;
      }
      await loadHistory();
      void loadInsights();
      setSaveMessage("Saved review updates.");
      setReviewViolations(null);
    } catch {
      setError("Network error while updating.");
    } finally {
      setUpdating(false);
    }
  }

  async function copyPublishMarkdown() {
    if (!selectedSaved) return;
    setError(null);
    setReviewViolations(null);
    try {
      const res = await fetch(`/api/seo/briefs/${selectedSaved.id}/export`);
      const body = (await res.json().catch(() => null)) as {
        markdown?: string;
        error?: string;
        violations?: unknown;
      } | null;
      if (!res.ok || !body?.markdown) {
        const violations =
          body && Array.isArray(body.violations)
            ? body.violations.filter((x): x is string => typeof x === "string")
            : [];
        setReviewViolations(violations.length > 0 ? violations : null);
        setError(body?.error ?? "Export failed.");
        return;
      }
      setReviewViolations(null);
      await copy(body.markdown);
      setSaveMessage("Publish markdown copied.");
    } catch {
      setError("Network error while exporting.");
    }
  }

  return (
    <div className="results">
      <form className="card" onSubmit={onSubmit}>
        <h2 className="section-title">Generate SEO brief</h2>
        <label htmlFor="seo-query">Long-tail query</label>
        <textarea
          id="seo-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="gift for remote coworker under $30 who likes coffee"
        />

        <div className="row">
          <div className="field-inline">
            <label htmlFor="locale">Locale</label>
            <input
              id="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="en-US"
            />
          </div>
          <div className="field-inline grow">
            <label htmlFor="audience">Audience hint (optional)</label>
            <input
              id="audience"
              value={audienceHint}
              onChange={(e) => setAudienceHint(e.target.value)}
              placeholder="office gift shoppers"
            />
          </div>
        </div>

        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Building brief..." : "Generate brief"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>

      {result ? (
        <section className="card seo-brief">
          <div className="seo-brief-head">
            <h2 className="section-title">SEO brief result</h2>
            <div className="row tight">
              <button type="button" onClick={() => copy(quickCopy)}>
                Copy core text
              </button>
              <button type="button" onClick={onSaveCurrent} disabled={saving}>
                {saving ? "Saving..." : "Save brief"}
              </button>
            </div>
          </div>
          {saveMessage ? <p className="notice">{saveMessage}</p> : null}
          {result.incompleteFallback ? (
            <p className="notice" role="status">
              Structural gaps were filled in on the server after two model attempts still missed limits.
              {result.structuralWarnings && result.structuralWarnings.length > 0 ? (
                <> Issues detected before fill: {result.structuralWarnings.join(", ")}.</>
              ) : null}{" "}
              Review and edit before approve or publish.
            </p>
          ) : null}

          <p className="seo-line">
            <strong>Intent:</strong> {result.brief.searchIntent}
          </p>
          <p className="seo-line">
            <strong>Canonical query:</strong> {result.brief.canonicalQuery}
          </p>
          <p className="seo-line">
            <strong>Title:</strong> {result.brief.title}
          </p>
          <p className="seo-line">
            <strong>Meta:</strong> {result.brief.metaDescription}
          </p>
          <p className="seo-line">
            <strong>H1:</strong> {result.brief.h1}
          </p>
          <p className="why">{result.brief.intro}</p>

          <h3 className="section-title">Sections</h3>
          <ul className="wish-list">
            {result.brief.sections.map((s) => (
              <li key={s.heading}>
                <strong>{s.heading}</strong>: {s.summary}
              </li>
            ))}
          </ul>

          <h3 className="section-title">FAQs</h3>
          <ul className="wish-list">
            {result.brief.faqs.map((f) => (
              <li key={f.question}>
                <strong>{f.question}</strong>: {f.answer}
              </li>
            ))}
          </ul>

          <h3 className="section-title">Internal links</h3>
          <p className="tags">
            {result.brief.internalLinkAnchors.map((a) => (
              <span className="tag" key={a}>
                {a}
              </span>
            ))}
          </p>

          <h3 className="section-title">Related long-tail queries</h3>
          <p className="tags">
            {result.brief.relatedQueries.map((q) => (
              <span className="tag" key={q}>
                {q}
              </span>
            ))}
          </p>

          <h3 className="section-title">Freshness + conversion notes</h3>
          <ul className="wish-list">
            {result.brief.freshnessNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {result.brief.conversionNudges.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>

          <p className="seo-line">
            <strong>Duplicate risk:</strong> {result.brief.duplicateRisk}
          </p>
        </section>
      ) : null}

      <section className="card">
        <div className="seo-brief-head">
          <h2 className="section-title">Saved briefs</h2>
          <div className="row tight">
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value as "all" | SeoBriefStatus)}
            >
              <option value="all">all statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={historyQueryFilter}
              onChange={(e) => setHistoryQueryFilter(e.target.value)}
              placeholder="search query..."
            />
          </div>
        </div>
        {historyLoading ? <p className="hint">Loading saved briefs...</p> : null}
        {!historyLoading && history.length === 0 ? (
          <p className="hint">No saved briefs yet.</p>
        ) : null}
        {history.length > 0 ? (
          <ul className="history-list">
            {history.map((item) => (
              <li key={item.id} className="history-item">
                <button type="button" className="history-open" onClick={() => openFromHistory(item)}>
                  <strong>{item.query}</strong> <span className={`badge status-${item.status}`}>{item.status}</span>
                  {item.isLowPerformer ? (
                    <span className="badge badge-warn" title="CTR below threshold with enough impressions">
                      low CTR
                    </span>
                  ) : null}
                  {item.inRefreshQueue ? (
                    <span className="badge badge-queue" title="Priority tag, stale publish, or low performer">
                      queue
                    </span>
                  ) : null}
                </button>
                <span className="hint">
                  {item.locale} - {new Date(item.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="card nested-card">
          <h3 className="section-title">Growth loop (prototype)</h3>
          <p className="hint">
            Traffic, CTR, and conversion are <strong>proxies</strong> you can increment for demos. Low performers use
            the same thresholds as review quality. Stale published briefs auto-join the refresh queue so you can
            schedule regenerations outside the app (cron hits <code>GET /api/seo/insights</code>).
          </p>
          <div className="row tight">
            <button type="button" onClick={() => void loadInsights()} disabled={insightsLoading}>
              {insightsLoading ? "Loading..." : "Load / refresh insights"}
            </button>
          </div>
          {insights ? (
            <>
              <h4 className="subsection-title">Low performers</h4>
              {insights.lowPerformers.length === 0 ? (
                <p className="hint">None right now (need enough impressions vs. clicks).</p>
              ) : (
                <ul className="history-list">
                  {insights.lowPerformers.map((x) => (
                    <li key={x.id} className="history-item">
                      <strong>{x.query}</strong>
                      <span className="hint">
                        {" "}
                        imp {x.impressions} / clk {x.clicks}
                        {x.ctr !== null ? ` CTR ${(x.ctr * 100).toFixed(2)}%` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h4 className="subsection-title">Refresh queue</h4>
              {insights.refreshQueue.length === 0 ? (
                <p className="hint">Empty (raise priority, add a seasonal tag, hit low CTR, or publish and age).</p>
              ) : (
                <ul className="history-list">
                  {insights.refreshQueue.map((x) => (
                    <li key={x.id} className="history-item">
                      <strong>{x.query}</strong>
                      <span className="hint">
                        {" "}
                        p{x.refreshPriority}
                        {x.seasonalTag ? ` tag: ${x.seasonalTag}` : ""}
                        {x.isLowPerformer ? " low" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint">
                Thresholds: min impressions {insights.thresholds.minImpressions}, max CTR{" "}
                {(insights.thresholds.maxCtr * 100).toFixed(2)}%, stale days {insights.thresholds.stalePublishedDays}.
              </p>
            </>
          ) : null}
        </div>

        {selectedSaved ? (
          <div className="card nested-card">
            <h3 className="section-title">Review workflow</h3>
            <p className="hint">
              Quality score: {(selectedSaved.qualityScore * 100).toFixed(0)}%
              {selectedSaved.qualityFlags.length > 0
                ? ` - flags: ${selectedSaved.qualityFlags.join(", ")}`
                : " - no quality flags"}
            </p>
            <div className="row">
              {statuses.map((s) => (
                <button key={s} type="button" disabled={updating} onClick={() => updateSelected(s)}>
                  Set {s}
                </button>
              ))}
              {selectedSaved.status === "approved" || selectedSaved.status === "published" ? (
                <button type="button" onClick={copyPublishMarkdown}>
                  Copy export markdown
                </button>
              ) : null}
            </div>
            {reviewViolations && reviewViolations.length > 0 ? (
              <ul className="error-list">
                {reviewViolations.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            ) : null}

            <h4 className="subsection-title">Metric proxies</h4>
            <p className="hint">
              Impressions {selectedSaved.impressions}, clicks {selectedSaved.clicks}, conversions{" "}
              {selectedSaved.conversions}
              {selectedSaved.ctr !== null ? `, CTR ${(selectedSaved.ctr * 100).toFixed(2)}%` : ""}
              {selectedSaved.metricsUpdatedAt
                ? ` (updated ${new Date(selectedSaved.metricsUpdatedAt).toLocaleString()})`
                : ""}
            </p>
            <div className="row tight">
              <button type="button" disabled={metricsPosting} onClick={() => void postMetric("impressions")}>
                +25 impressions
              </button>
              <button type="button" disabled={metricsPosting} onClick={() => void postMetric("clicks")}>
                +1 click
              </button>
              <button type="button" disabled={metricsPosting} onClick={() => void postMetric("conversions")}>
                +1 conversion
              </button>
            </div>

            <h4 className="subsection-title">Seasonal / refresh queue</h4>
            <div className="row">
              <div className="field-inline">
                <label htmlFor="prio">Priority (0-3)</label>
                <select
                  id="prio"
                  value={priorityEdit}
                  onChange={(e) => setPriorityEdit(e.target.value)}
                  aria-label="Refresh priority"
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-inline grow">
                <label htmlFor="seasonal-tag">Seasonal tag</label>
                <input
                  id="seasonal-tag"
                  value={seasonalTagEdit}
                  onChange={(e) => setSeasonalTagEdit(e.target.value)}
                  placeholder="e.g. winter-2026"
                />
              </div>
            </div>
            <div className="row">
              <button type="button" disabled={updating} onClick={() => void saveGrowthFields()}>
                Save priority and tag
              </button>
            </div>

            <div className="row">
              <div className="field-inline grow">
                <label htmlFor="owner-edit">Owner</label>
                <input
                  id="owner-edit"
                  value={ownerEdit}
                  onChange={(e) => setOwnerEdit(e.target.value)}
                  placeholder="content owner"
                />
              </div>
            </div>
            <label htmlFor="review-notes">Reviewer notes</label>
            <textarea
              id="review-notes"
              value={reviewerNotesEdit}
              onChange={(e) => setReviewerNotesEdit(e.target.value)}
              placeholder="Add review notes..."
            />
            <div className="row">
              <button type="button" disabled={updating} onClick={() => updateSelected()}>
                {updating ? "Updating..." : "Save notes"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {rawFallback ? (
        <pre className="card raw-fallback" aria-label="Raw SEO response">
          {rawFallback}
        </pre>
      ) : null}
    </div>
  );
}
