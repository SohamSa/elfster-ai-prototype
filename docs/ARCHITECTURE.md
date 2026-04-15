# System architecture — how it works

This document describes the **path from a user question to gift suggestions**, in plain language.

## Step-by-step flow

- **User input** — Someone types a free-form message, for example: *gift for coworker under $25*. They do not need a special format.

- **Understanding the request** — An AI step reads the message and fills in a **simple structured picture** of what they want: who the gift is for, budget, occasion, interests, tone, and any other hints that were implied.

- **Narrowing the catalog** — The system compares that picture to a **stored list of gift ideas** and keeps only items that match the important details (such as price and who it is appropriate for).

- **Ranking results** — Among the items that still fit, the system **orders them** so the strongest matches appear first.

- **Explanations** — For the top suggestions, the system adds **short, friendly reasons** why each pick could work for this person and situation.

- **Optional web-ready copy** — When desired, the system can also produce **extra titles or descriptions** aimed at helping pages show up clearly in search and read well when shared online. This step is separate from the short explanations above.

## One-line summary

**Messy question → clear wish list → matched and ordered ideas → human-friendly notes → optional longer text for discovery.**
