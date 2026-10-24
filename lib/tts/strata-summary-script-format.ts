/**
 * Collapses whitespace for Strata overview scripts; keeps spaces around Eleven v3 `[tag]` segments.
 */
export function normalizeSummaryScriptWhitespace(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s*(\[[^\]]+\])\s*/g, " $1 ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
