import DOMPurify from "isomorphic-dompurify";

import { RABBIT_HOLE_ARTICLE_POLICY } from "./article-policy";

/**
 * Server-side sanitizers.
 *
 * `isomorphic-dompurify` builds a JSDOM window at module evaluation, so anything
 * importing this module pays for jsdom. Import it only from server code — a
 * "use client" component is still evaluated during SSR, which would drag jsdom
 * into the SSR bundle. Browser-side sanitizing lives in lib/html/sanitize-browser.ts.
 */

/**
 * Sanitize LLM-generated rabbit-hole article HTML.
 * Strips scripts, event handlers, and disallowed tags/attributes.
 *
 * This is the trust boundary for article HTML. It runs where the content is
 * produced (lib/rabbit-holes/actions.ts) and where it is read back out of
 * Supabase (data/supabase/rabbitholes.ts), so rows written before this existed
 * are sanitized on the way out too. RabbitHoleArticle re-runs the same policy in
 * the browser, but SSR renders what these two paths produced.
 */
export function sanitizeRabbitHoleArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, RABBIT_HOLE_ARTICLE_POLICY);
}
