import { RABBIT_HOLE_UNTITLED } from "./constants";

/** Stored node titles must satisfy RabbitHoleNodeSchema (min 4, max 80). */
export const RABBIT_HOLE_ARTICLE_TITLE_MAX = 80;

/**
 * Normalize a model title for persistence.
 * Long titles are truncated so generation can succeed when the model exceeds 80 characters.
 */
export function resolvedArticleTitle(title: string): string {
  const trimmed = title.replace(/\s+/g, " ").trim();

  if (trimmed.length < 4) return RABBIT_HOLE_UNTITLED;
  if (trimmed.length <= RABBIT_HOLE_ARTICLE_TITLE_MAX) return trimmed;

  const sliced = trimmed.slice(0, RABBIT_HOLE_ARTICLE_TITLE_MAX).trimEnd();

  return sliced.length >= 4 ? sliced : RABBIT_HOLE_UNTITLED;
}
