/**
 * The sanitizer policy for rabbit-hole article HTML.
 *
 * Kept dependency-free and separate from the sanitizers themselves so the server
 * pass (lib/html/sanitize.ts) and the browser re-check (lib/html/sanitize-browser.ts)
 * can never drift apart — a tag allowed in one but not the other would either strip
 * content the other kept or admit markup the other rejected.
 */

/** Tags allowed in rabbit-hole LLM article HTML (see lib/system-prompt/rabbit-hole.ts). */
const ALLOWED_TAGS = [
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

const ALLOWED_ATTR = ["id", "class", "data-branch-id", "href", "target", "rel"];

/**
 * Not `as const`: DOMPurify's `Config` types these as mutable `string[]`, so a
 * readonly tuple fails to type check at the call site.
 */
export const RABBIT_HOLE_ARTICLE_POLICY = {
  ALLOWED_TAGS: [...ALLOWED_TAGS],
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: /^https?:/i,
};
