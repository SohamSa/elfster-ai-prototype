# Implementation checklist — AI gifting prototype

Use this list as a **step-by-step build guide**. Check items off as you finish them.

---

## Phase 1 — Setup

- [x] Decide what tools you will use (editor, language, and where the app will run).
- [x] Create a fresh project folder and a simple way to **run the app on your computer** for testing.
- [x] Add a safe place to store **settings** (for example, sign-in details for the AI service—never paste real secrets into public or shared copies of the project).
- [x] Write a short note in the project explaining how **you** start the app locally (so future-you remembers the steps).

---

## Phase 2 — Data / database

- [x] List the **facts you want to know about each gift** (for example: title, short description, price, who it suits, tags for interests or occasions).
- [x] Choose how gifts will be **stored** (a file, a spreadsheet export, or a small database—whatever matches your comfort level).
- [x] Add a **starter set** of real or sample gifts with those fields filled in.
- [x] Build a small helper that can **load all gifts** and **filter** them by price and other simple rules you care about first.

---

## Phase 3 — AI logic

- [x] Define what a **parsed wish** should look like (budget, recipient type, interests, occasion, season—only what you will actually use).
- [x] Add a step where the AI reads the **user’s message** and fills in that **parsed wish** (ask the AI to stick to your field names).
- [x] Connect **parsed wish → filtering**: keep gifts that match the important parts of the wish.
- [x] Add **ranking**: order the remaining gifts so the best-feeling matches appear first (rules, scoring, or a second AI pass—pick one approach and keep it simple at first).
- [x] Add **short explanations**: for each top gift, ask the AI why it fits **this** user message (one or two friendly sentences).
- [x] Add **optional SEO-style text**: only when turned on, ask the AI for a longer title or blurb suitable for sharing or search (separate from the short explanation).

---

## Phase 4 — API layer

- [x] Expose one clear **“suggest gifts”** action that accepts the user’s text (and any options, like “include SEO text: yes/no”).
- [x] Inside that action, run the steps in order: **parse wish → filter → rank → explanations → optional SEO**.
- [x] Return a **simple, consistent result shape** (for example: list of gifts, each with title, price, explanation, and optional SEO fields).
- [x] Add **basic error handling** for empty input, AI timeouts, or no matches (friendly message back to the caller).

---

## Phase 5 — Frontend

- [x] Add a **text box** where the user can type a gift question in plain language.
- [x] Add any **simple toggles** you need (for example: “include SEO-style descriptions”).
- [x] Wire the **Submit** action to call your “suggest gifts” layer and show a **loading** state while waiting.
- [x] Display **ranked results** with price and the **short explanation** under each idea.
- [x] If the user asked for it, show the **extra SEO-style text** in a separate, clearly labeled area (so it does not clutter the main list).
- [x] Do a quick **pass on readability**: spacing, labels, and a line of help text so first-time visitors know what to type.

---

## After the first version

- [ ] Try **5–10 real questions** friends might ask; note gaps in data or parsing.
- [ ] Adjust **gift data**, **filter rules**, or **prompt wording** based on what felt wrong—not by adding complexity first.
