/**
 * Runs the article-HTML sanitizers in a bare runtime (no JSDOM preload) and
 * prints the outcome as JSON. Spawned by tests/unit/article-sanitize-bare.test.ts,
 * which cannot assert this in-process: the unit-test preload installs a global
 * `window`, which makes the browser DOMPurify build functional and hides the
 * server-side and SSR behaviour being guarded.
 *
 * The input comes in as argv[2] so the test owns the fixture.
 */
import { sanitizeRabbitHoleArticleHtml } from "@/lib/html/sanitize";
import { reSanitizeArticleHtmlInBrowser } from "@/lib/html/sanitize-browser";

const input = process.argv[2] ?? "<p>no input</p>";

const probe = {
  hasWindow: typeof (globalThis as { window?: unknown }).window !== "undefined",
  server: await sanitizeRabbitHoleArticleHtml(input),
  sink: reSanitizeArticleHtmlInBrowser(input),
};

console.log(JSON.stringify(probe));
