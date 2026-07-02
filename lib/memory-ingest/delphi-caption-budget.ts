export type DeviceTier = "mobile" | "tablet" | "desktop";

/** Raw measured inputs from the client (px/rem typography + layout). */
export type DelphiDisplayInput = {
  viewportWidthPx: number;
  viewportHeightPx: number;
  devicePixelRatio: number;
  screenWidthPx: number;
  screenHeightPx: number;
  captionWidthPx: number;
  captionAllocatedHeightPx: number;
  fontSizePx: number;
  lineHeightPx: number;
  avgCharWidthPx?: number;
  userAgent?: string;
  deviceTier: DeviceTier;
  /** Root font size for rem clamps (default 16). */
  rootFontSizePx?: number;
};

export type DelphiCaptionBudget = {
  visibleLines: number;
  scrollMaxLines: number;
  maxCharsPerLine: number;
  visibleHeightPx: number;
  scrollMaxHeightPx: number;
  lineHeightPx: number;
  fontSizePx: number;
  captionWidthPx: number;
  physicalWidthIn: number;
  physicalHeightIn: number;
  deviceLabel: string;
  promptText: string;
};

/** Fallback average char width as fraction of font size (proportional sans). */
export const AVG_CHAR_WIDTH_EM = 0.52;

/** Min caption band height (~3 lines at 15px / 1.375 lh). */
export const MIN_CAPTION_HEIGHT_REM = 3 * 0.9375 * 1.375;

/** Absolute scroll cap for caption content height. */
export const MAX_SCROLL_CAPTION_REM = 32;

/** Fraction of viewport height available as extra scroll below visible band. */
export const SCROLL_VIEWPORT_FRACTION = 0.35;

const MIN_CHARS_PER_LINE = 24;
const MAX_CHARS_PER_LINE = 100;

const CSS_PPI = 96;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function resolveDeviceLabel(userAgent: string | undefined, deviceTier: DeviceTier): string {
  if (!userAgent) {
    return deviceTier === "desktop" ? "desktop browser" : `${deviceTier} browser`;
  }

  const ua = userAgent.toLowerCase();

  if (/iphone/.test(ua)) {
    const model = userAgent.match(/iPhone\s*[\d,]+/)?.[0];

    return model ? `${model} (Safari)` : "iPhone";
  }
  if (/ipad/.test(ua)) return "iPad";
  if (/android/.test(ua)) return "Android device";
  if (/macintosh/.test(ua) && deviceTier === "desktop") return "macOS desktop browser";
  if (/windows/.test(ua)) return "Windows desktop browser";
  if (/linux/.test(ua)) return "Linux desktop browser";

  return deviceTier === "desktop" ? "desktop browser" : `${deviceTier} browser`;
}

/** Estimate physical screen dimensions in inches (prompt context only). */
export function estimatePhysicalScreenInches(
  screenWidthPx: number,
  screenHeightPx: number,
  devicePixelRatio: number
): { physicalWidthIn: number; physicalHeightIn: number } {
  const cssWidth = screenWidthPx / Math.max(devicePixelRatio, 1);
  const cssHeight = screenHeightPx / Math.max(devicePixelRatio, 1);

  return {
    physicalWidthIn: Math.round((cssWidth / CSS_PPI) * 10) / 10,
    physicalHeightIn: Math.round((cssHeight / CSS_PPI) * 10) / 10,
  };
}

export function effectiveCharWidthPx(fontSizePx: number, avgCharWidthPx?: number): number {
  if (avgCharWidthPx != null && avgCharWidthPx > 0) {
    return avgCharWidthPx;
  }

  return fontSizePx * AVG_CHAR_WIDTH_EM;
}

export function buildDelphiDisplayPromptText(budget: Omit<DelphiCaptionBudget, "promptText">): string {
  const {
    deviceLabel,
    physicalWidthIn,
    physicalHeightIn,
    captionWidthPx,
    visibleHeightPx,
    visibleLines,
    lineHeightPx,
    maxCharsPerLine,
    scrollMaxLines,
  } = budget;

  return (
    `\n\n[Delphi display context]\n` +
    `Device: ${deviceLabel}. Effective screen area ~${physicalWidthIn}×${physicalHeightIn} in.\n` +
    `Assistant caption band: ${Math.round(captionWidthPx)}px wide × ${Math.round(visibleHeightPx)}px tall ` +
    `(${visibleLines} visible lines at ${Math.round(lineHeightPx * 10) / 10}px line-height, ~${maxCharsPerLine} chars/line).\n` +
    `Keep responses within ${visibleLines} visible lines by default. ` +
    `If essential, you may use up to ${scrollMaxLines} lines total; content beyond line ${visibleLines} requires the user to scroll.\n` +
    `Prefer short paragraphs; one question per turn when interviewing.`
  );
}

/**
 * Derive visible line budget, scroll allowance, and chars/line from measured px/rem inputs.
 * All line counts are computed — never hardcoded per device.
 */
export function computeDelphiCaptionBudget(input: DelphiDisplayInput): DelphiCaptionBudget {
  const rootFontSizePx = input.rootFontSizePx ?? 16;
  const lineHeightPx = Math.max(input.lineHeightPx, 1);
  const fontSizePx = Math.max(input.fontSizePx, 1);
  const captionWidthPx = Math.max(input.captionWidthPx, 1);

  const minCaptionHeightPx = MIN_CAPTION_HEIGHT_REM * rootFontSizePx;
  const allocatedHeightPx = clamp(
    input.captionAllocatedHeightPx,
    minCaptionHeightPx,
    input.viewportHeightPx * 0.55
  );

  const visibleLines = Math.max(1, Math.floor(allocatedHeightPx / lineHeightPx));
  const visibleHeightPx = visibleLines * lineHeightPx;

  const extraScrollPx = Math.min(
    input.viewportHeightPx * SCROLL_VIEWPORT_FRACTION,
    MAX_SCROLL_CAPTION_REM * rootFontSizePx
  );
  const scrollMaxLines = visibleLines + Math.max(0, Math.floor(extraScrollPx / lineHeightPx));
  const scrollMaxHeightPx = scrollMaxLines * lineHeightPx;

  const charWidth = effectiveCharWidthPx(fontSizePx, input.avgCharWidthPx);
  const maxCharsPerLine = clamp(
    Math.floor(captionWidthPx / charWidth),
    MIN_CHARS_PER_LINE,
    MAX_CHARS_PER_LINE
  );

  const { physicalWidthIn, physicalHeightIn } = estimatePhysicalScreenInches(
    input.screenWidthPx,
    input.screenHeightPx,
    input.devicePixelRatio
  );

  const deviceLabel = resolveDeviceLabel(input.userAgent, input.deviceTier);

  const base = {
    visibleLines,
    scrollMaxLines,
    maxCharsPerLine,
    visibleHeightPx,
    scrollMaxHeightPx,
    lineHeightPx,
    fontSizePx,
    captionWidthPx,
    physicalWidthIn,
    physicalHeightIn,
    deviceLabel,
  };

  return {
    ...base,
    promptText: buildDelphiDisplayPromptText(base),
  };
}

/** Approximate character budget for Delphi response-length wrapper. */
export function delphiScrollCharBudget(budget: DelphiCaptionBudget): number {
  return budget.scrollMaxLines * budget.maxCharsPerLine;
}

/**
 * Compute how much vertical space (px) is available for the caption band given shell layout.
 * Shared between client hook and tests.
 */
export function computeCaptionAllocatedHeightPx(params: {
  viewportHeightPx: number;
  dockHeightPx: number;
  shellTopPaddingPx: number;
  captionMarginPx: number;
  particleMinReservePx: number;
  safeAreaBottomPx?: number;
}): number {
  const {
    viewportHeightPx,
    dockHeightPx,
    shellTopPaddingPx,
    captionMarginPx,
    particleMinReservePx,
    safeAreaBottomPx = 0,
  } = params;

  const used =
    dockHeightPx + shellTopPaddingPx + captionMarginPx + particleMinReservePx + safeAreaBottomPx;

  return Math.max(0, viewportHeightPx - used);
}

/** Canvas-based average char width for a given computed font string (client only). */
export function measureAvgCharWidthPx(font: string, sample = "abcdefghijklmnopqrstuvwxyz "): number {
  if (typeof document === "undefined") {
    return 0;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return 0;

  ctx.font = font;
  const metrics = ctx.measureText(sample);

  return metrics.width / sample.length;
}
