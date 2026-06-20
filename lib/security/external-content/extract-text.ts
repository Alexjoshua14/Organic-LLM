import { JSDOM } from "jsdom";
import DOMPurify from "isomorphic-dompurify";

const DEFAULT_MAX_CHARS = 5000;

/** Strip control chars and zero-width characters that can hide prompt-injection payloads. */
export function stripControlAndZeroWidth(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u180E]/g, "")
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
 */
export function extractReadableText(
  body: string,
  options: ExtractReadableTextOptions = {}
): { text: string; truncated: boolean } {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const contentType = options.contentType?.toLowerCase() ?? "";

  let raw = body;

  if (contentType.includes("text/html") || contentType.includes("application/xhtml") || looksLikeHtml(body)) {
    raw = htmlToPlainText(body);
  }

  raw = stripControlAndZeroWidth(normalizeWhitespace(raw));

  if (raw.length <= maxChars) {
    return { text: raw, truncated: false };
  }

  return { text: raw.slice(0, maxChars), truncated: true };
}

function looksLikeHtml(input: string): boolean {
  const trimmed = input.trimStart();

  return trimmed.startsWith("<!") || trimmed.startsWith("<html") || /<\/\w+>/.test(trimmed.slice(0, 500));
}

function htmlToPlainText(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  for (const selector of ["script", "style", "noscript", "template", "svg", "iframe", "object", "embed"]) {
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
