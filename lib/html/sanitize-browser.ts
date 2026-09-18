import DOMPurify from "dompurify";

/**
 * Browser-only HTML sanitizers.
 *
 * Split out of lib/html/sanitize.ts, which imports `isomorphic-dompurify` — that
 * package builds a JSDOM window at *module evaluation*. A "use client" component
 * is still evaluated on the server during SSR, so importing it from one drags
 * jsdom into the SSR bundle, where its CJS/ESM interop needs Node >= 20.19/22.12
 * and otherwise throws ERR_REQUIRE_ESM before the page renders at all.
 *
 * Everything here runs after Mermaid has rendered in the browser, so plain
 * `dompurify` (no dependencies of its own) is enough.
 */

/**
 * The DOMPurify instance, or a throw when there is no DOM behind it.
 *
 * Guards on `isSupported` rather than `typeof sanitize`: `ensureMermaidParseSanitizer`
 * in lib/mermaid/validate.ts replaces `sanitize` with a passthrough server-side so
 * Mermaid can parse under node/bun, and deliberately leaves `isSupported` false to
 * mark the stub. Checking for a callable `sanitize` would therefore accept that
 * passthrough and return unsanitized markup.
 */
function browserPurifier(): typeof DOMPurify {
  if (!DOMPurify.isSupported) {
    throw new Error(
      "lib/html/sanitize-browser was called without a DOM. These helpers are browser-only; " +
        "server-side callers belong in lib/html/sanitize.ts."
    );
  }

  return DOMPurify;
}

/**
 * Sanitize Mermaid SVG output before assigning to innerHTML.
 */
export function sanitizeMermaidSvgMarkup(svgMarkup: string): string {
  return browserPurifier().sanitize(svgMarkup, {
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
