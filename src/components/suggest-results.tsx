import type { ParsedWishDto, SuggestResultRow } from "@/lib/types/suggest";
import { formatUsd } from "@/lib/types/suggest";
import { wishSchema } from "@/lib/schemas/wish";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isGiftDto(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.description === "string" &&
    typeof v.priceCents === "number" &&
    Array.isArray(v.tags)
  );
}

function isSuggestResultRow(v: unknown): v is SuggestResultRow {
  if (!isRecord(v) || typeof v.explanation !== "string") return false;
  return isGiftDto(v.gift);
}

export function parseSuggestSuccess(body: unknown): {
  ok: true;
  wish: ParsedWishDto;
  results: SuggestResultRow[];
  message?: string;
} | { ok: false } {
  if (!isRecord(body)) return { ok: false };
  const parsedWish = wishSchema.safeParse(body.wish);
  if (!parsedWish.success) return { ok: false };
  const raw = body.results;
  if (!Array.isArray(raw) || !raw.every(isSuggestResultRow)) return { ok: false };
  const message = typeof body.message === "string" ? body.message : undefined;
  return { ok: true, wish: parsedWish.data, results: raw, message };
}

type Props = {
  wish: ParsedWishDto;
  results: SuggestResultRow[];
  message?: string;
  includeSeo: boolean;
};

export function SuggestResults({ wish, results, message, includeSeo }: Props) {
  return (
    <div className="results">
      <section className="wish-panel card">
        <h2 className="section-title">What we understood</h2>
        <ul className="wish-list">
          <li>
            <strong>Budget (max)</strong>:{" "}
            {wish.budgetMaxCents != null ? formatUsd(wish.budgetMaxCents) : "—"}
          </li>
          <li>
            <strong>For</strong>: {wish.recipient ?? "—"}
          </li>
          <li>
            <strong>Occasion</strong>: {wish.occasion ?? "—"}
          </li>
          <li>
            <strong>Interests / tags</strong>:{" "}
            {wish.interests.length ? wish.interests.join(", ") : "—"}
          </li>
          {wish.notes ? (
            <li>
              <strong>Notes</strong>: {wish.notes}
            </li>
          ) : null}
        </ul>
      </section>

      {message && results.length === 0 ? (
        <p className="notice">{message}</p>
      ) : null}

      {results.length > 0 ? (
        <section className="gift-list">
          <h2 className="section-title">Ideas for you</h2>
          <ol className="ranked">
            {results.map((row, i) => (
              <li key={row.gift.id} className="gift-card card">
                <div className="gift-head">
                  <span className="rank">#{i + 1}</span>
                  <h3 className="gift-title">{row.gift.title}</h3>
                  <span className="price">{formatUsd(row.gift.priceCents)}</span>
                </div>
                <p className="gift-desc">{row.gift.description}</p>
                {row.gift.tags.length > 0 ? (
                  <p className="tags">
                    {row.gift.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="why">{row.explanation}</p>
                {includeSeo && (row.seoTitle || row.seoDescription) ? (
                  <div className="seo-block">
                    <h4 className="seo-title">SEO-style copy</h4>
                    {row.seoTitle ? <p className="seo-line"><strong>Title:</strong> {row.seoTitle}</p> : null}
                    {row.seoDescription ? (
                      <p className="seo-line">
                        <strong>Description:</strong> {row.seoDescription}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
