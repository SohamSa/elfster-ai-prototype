# SEO discovery architecture (v2)

This architecture upgrades the project from 3 gift-matching problems to **10 real SEO/discovery business problems**.

## Goal

Turn long-tail gift searches into focused pages that rank better, stay fresh, and convert visitors.

## Flow

1. **Query input**
   - Example: `gift for remote coworker under $30 who likes coffee`.

2. **SEO brief generation (`/api/seo/brief`)**
   - AI creates a structured page brief:
     - page title + meta description
     - H1 + intro
     - key sections
     - FAQs
     - conversion nudges
     - freshness notes
     - internal link anchor ideas
     - related long-tail queries

3. **Problem-aware content strategy**
   - Brief is forced to address all 10 business problems:
     - long-tail coverage
     - intent match
     - ranking relevance
     - duplication risk
     - thin pages
     - internal linking
     - freshness
     - conversion
     - discovery of new ideas
     - consistent brand trust

4. **Publishing workflow (next step)**
   - Content/editor teams review and publish pages from briefs.

5. **Performance loop (next step)**
   - Compare results over time (traffic, click-through, conversion) and regenerate weaker pages.

## Why this is a strong upgrade

- Keeps the current gift recommendation system working.
- Adds a dedicated SEO/discovery layer for growth.
- Uses AI in a controlled, structured format instead of random free-form outputs.
