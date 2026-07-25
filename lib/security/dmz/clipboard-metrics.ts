/** Client-safe clipboard payload metrics (no content retained in UI). */

const DEFAULT_FONT_SIZE_PX = 14;
const AVG_CHAR_WIDTH_RATIO = 0.52;

export type DmzClipboardMetrics = {
  charCount: number;
  lineCount: number;
  estimatedTokens: number;
};

export function estimateTokenCountFromText(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) return 0;

  // ~4 chars per token for English prose (display estimate only).
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

/**
 * Estimate wrapped line count using viewport width and typical UI font size.
 * Uses `window` when available; falls back to a phone-width default.
 */
export function estimateWrappedLineCount(
  text: string,
  opts?: {
    containerWidthPx?: number;
    fontSizePx?: number;
  }
): number {
  const trimmed = text.trim();

  if (!trimmed) return 0;

  const fontSize = opts?.fontSizePx ?? DEFAULT_FONT_SIZE_PX;
  const width =
    opts?.containerWidthPx ??
    (typeof window !== "undefined" ? Math.min(window.innerWidth - 48, 560) : 360);

  const charsPerLine = Math.max(24, Math.floor(width / (fontSize * AVG_CHAR_WIDTH_RATIO)));

  const logicalLines = trimmed.split(/\r?\n/);
  let total = 0;

  for (const line of logicalLines) {
    total += Math.max(1, Math.ceil(line.length / charsPerLine));
  }

  return total;
}

export function measureDmzClipboard(text: string, opts?: { containerWidthPx?: number }): DmzClipboardMetrics {
  const charCount = text.length;

  return {
    charCount,
    lineCount: estimateWrappedLineCount(text, opts),
    estimatedTokens: estimateTokenCountFromText(text),
  };
}
