/** Shapes returned by POST /api/suggest (success). */

export type GiftDto = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  tags: string[];
  audience: string | null;
  occasion: string | null;
};

export type ParsedWishDto = {
  budgetMaxCents: number | null;
  interests: string[];
  recipient: string | null;
  occasion: string | null;
  notes: string | null;
};

export type SuggestResultRow = {
  gift: GiftDto;
  explanation: string;
  seoTitle?: string;
  seoDescription?: string;
};

export type SuggestSuccessBody = {
  wish: ParsedWishDto;
  results: SuggestResultRow[];
  message?: string;
};

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}
