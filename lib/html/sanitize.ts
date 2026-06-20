import DOMPurify from "isomorphic-dompurify";

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
 */
export function sanitizeRabbitHoleArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RABBIT_HOLE_ARTICLE_ALLOWED_TAGS],
    ALLOWED_ATTR: RABBIT_HOLE_ARTICLE_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: /^https?:/i,
  });
}

/**
 * Sanitize Mermaid SVG output before assigning to innerHTML.
 */
export function sanitizeMermaidSvgMarkup(svgMarkup: string): string {
  return DOMPurify.sanitize(svgMarkup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["foreignObject"],
    ADD_ATTR: ["target", "xlink:href"],
  });
}

/**
 * Ensure DOMPurify is available for Mermaid strict securityLevel in the browser.
 */
export function ensureMermaidDomPurify(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { DOMPurify?: typeof DOMPurify };

  if (!w.DOMPurify) {
    w.DOMPurify = DOMPurify;
  }
}
