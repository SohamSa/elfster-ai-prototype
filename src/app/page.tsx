import { SuggestForm } from "@/components/suggest-form";

export default function HomePage() {
  return (
    <main>
      <h1>Elfster AI prototype</h1>
      <p className="lead">
        Describe who you are shopping for. Stack: Next.js, Prisma + Neon, Vercel AI SDK, OpenAI
        (default <code>gpt-4o</code>; optional <code>OPENAI_SUGGESTION_MODEL=gpt-4o-mini</code> in{" "}
        <code>.env</code>), Upstash Redis optional for rate limits.
      </p>
      <SuggestForm />
      <p className="footer-links">
        <a href="/seo">SEO brief lab</a>
        <a href="/api/health">API health</a>
        <a href="https://github.com/vercel/ai">Vercel AI SDK</a>
      </p>
    </main>
  );
}
