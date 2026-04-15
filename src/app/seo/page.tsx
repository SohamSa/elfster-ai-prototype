import { SeoBriefForm } from "@/components/seo-brief-form";

export default function SeoPage() {
  return (
    <main>
      <h1>SEO discovery brief lab</h1>
      <p className="lead">
        Generate structured SEO page briefs for long-tail gift queries. This supports the upgraded
        10-business-problem version: intent match, relevance, freshness, internal linking, and
        conversion-focused content planning.
      </p>
      <SeoBriefForm />
      <p className="footer-links">
        <a href="/">Gift suggestion app</a>
        <a href="/api/seo/brief">SEO brief API</a>
      </p>
    </main>
  );
}
