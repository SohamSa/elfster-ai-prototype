import { openai } from "@ai-sdk/openai";

/**
 * Model for intent, explanations, and SEO-style copy.
 * Override with OPENAI_SUGGESTION_MODEL (e.g. gpt-4o-mini) in .env for lower cost after billing is enabled.
 */
const name = (process.env.OPENAI_SUGGESTION_MODEL ?? "gpt-4o").trim() || "gpt-4o";

/**
 * Dedicated model for SEO/discovery content briefs in the upgraded 10-problem workflow.
 */
const seoName = (process.env.OPENAI_SEO_MODEL ?? name).trim() || name;

export const suggestionModel = openai(name);
export const seoModel = openai(seoName);

export function getSuggestionModel(modelOverride?: string) {
  const selected = (modelOverride?.trim() || name).trim();
  return openai(selected || name);
}

export function getSeoModel(modelOverride?: string) {
  const selected = (modelOverride?.trim() || seoName).trim();
  return openai(selected || seoName);
}
