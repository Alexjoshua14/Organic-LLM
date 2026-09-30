import { RABBIT_HOLE_ARTICLE_POLICY } from "./article-policy";

/**
 * Server-side sanitizers.
 *
 * `isomorphic-dompurify` builds a JSDOM window at module evaluation, so it is
 * loaded on first use rather than imported at the top. This module is reachable
 * from the rabbit-hole server actions, and Next bundles server actions into
 * shared chunks that routes load; a static import here would put jsdom in front
 * of every page, where its CJS/ESM interop needs Node >= 20.19/22.12 and
 * otherwise throws ERR_REQUIRE_ESM before anything renders. Browser-side
 * sanitizing lives in lib/html/sanitize-browser.ts.
 */

/**
 * Sanitize LLM-generated rabbit-hole article HTML.
 * Strips scripts, event handlers, and disallowed tags/attributes.
 *
 * This is the trust boundary for article HTML. It runs where the content is
 * produced (lib/rabbit-holes/actions.ts) and where it is read back out of
 * Supabase (data/supabase/rabbitholes.ts), so rows written before this existed
 * are sanitized on the way out too. RabbitHoleArticle re-runs the same policy in
 * the browser; during SSR it renders what these two paths produced.
 */
export async function sanitizeRabbitHoleArticleHtml(html: string): Promise<string> {
  const { default: DOMPurify } = await import("isomorphic-dompurify");

  return DOMPurify.sanitize(html, RABBIT_HOLE_ARTICLE_POLICY);
}
