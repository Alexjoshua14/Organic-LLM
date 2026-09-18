const DEFAULT_MAX_CHARS = 5000;

/**
 * jsdom and `isomorphic-dompurify` are loaded on first use rather than imported
 * at the top of this module. Both pull jsdom in eagerly — `isomorphic-dompurify`
 * builds a JSDOM window at module evaluation — and this module is reachable from
 * the rabbit-hole server actions, which Next bundles into shared server chunks
 * that every route's SSR set loads. A static import there puts jsdom in front of
 * every page, where its CJS/ESM interop needs Node >= 20.19/22.12 and otherwise
 * throws ERR_REQUIRE_ESM before anything renders.
 */
async function loadHtmlTools() {
  const [{ JSDOM }, { default: DOMPurify }] = await Promise.all([
    import("jsdom"),
    import("isomorphic-dompurify"),
  ]);

  return { JSDOM, DOMPurify };
}

/** Strip control chars and zero-width characters that can hide prompt-injection payloads. */
export function stripControlAndZeroWidth(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[​-‍﻿⁠᠎]/g, "")
    .normalize("NFKC");
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export type ExtractReadableTextOptions = {
  maxChars?: number;
  contentType?: string | null;
};

/**
 * Convert HTML or plain text into readable, length-capped plain text for LLM prompts.
 *
 * Async only because the HTML path loads jsdom lazily; plain text never touches it.
 */
export async function extractReadableText(
  body: string,
  options: ExtractReadableTextOptions = {}
): Promise<{ text: string; truncated: boolean }> {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const contentType = options.contentType?.toLowerCase() ?? "";

  let raw = body;

  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml") ||
    looksLikeHtml(body)
  ) {
    raw = await htmlToPlainText(body);
  }

  raw = stripControlAndZeroWidth(normalizeWhitespace(raw));

  if (raw.length <= maxChars) {
    return { text: raw, truncated: false };
  }

  return { text: raw.slice(0, maxChars), truncated: true };
}

function looksLikeHtml(input: string): boolean {
  const trimmed = input.trimStart();

  return (
    trimmed.startsWith("<!") || trimmed.startsWith("<html") || /<\/\w+>/.test(trimmed.slice(0, 500))
  );
}

async function htmlToPlainText(html: string): Promise<string> {
  const { JSDOM, DOMPurify } = await loadHtmlTools();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  for (const selector of [
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "iframe",
    "object",
    "embed",
  ]) {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  }

  const sanitized = DOMPurify.sanitize(doc.body?.innerHTML ?? html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  const textDom = new JSDOM(`<body>${sanitized}</body>`);

  return textDom.window.document.body?.textContent ?? sanitized;
}
