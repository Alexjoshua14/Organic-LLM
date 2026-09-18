import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizers that must also work on the server.
 *
 * `isomorphic-dompurify` builds a JSDOM window at module evaluation, so importing
 * this module costs jsdom in every bundle that reaches it — including the SSR pass
 * of any "use client" component. Keep browser-only sanitizers in
 * lib/html/sanitize-browser.ts so they do not pay that cost.
 */

/** Tags allowed in rabbit-hole LLM article HTML (see lib/system-prompt/rabbit-hole.ts). */
const RABBIT_HOLE_ARTICLE_ALLOWED_TAGS = [
  "h2",
  "h3",
  "p",
  "span",
  "strong",
  "em",
  "a",
  "pre",
  "code",
  "blockquote",
] as const;

const RABBIT_HOLE_ARTICLE_ALLOWED_ATTR = ["id", "class", "data-branch-id", "href", "target", "rel"];

/**
 * Sanitize LLM-generated rabbit-hole article HTML before rendering.
 * Strips scripts, event handlers, and disallowed tags/attributes.
 *
 * Runs during render in RabbitHoleArticle, which server-renders on
 * /sandbox/prototypes/morphs/chat-archetype, so this one genuinely needs a
 * server-side DOM.
 */
export function sanitizeRabbitHoleArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RABBIT_HOLE_ARTICLE_ALLOWED_TAGS],
    ALLOWED_ATTR: RABBIT_HOLE_ARTICLE_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: /^https?:/i,
  });
}
