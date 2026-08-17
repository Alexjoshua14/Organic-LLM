export type DrawerSheetSnap = "collapsed" | "half" | "full";

export type DrawerChatDisplayInput = {
  viewportWidthPx: number;
  viewportHeightPx: number;
  sheetSnap: DrawerSheetSnap;
  aiBlockMaxHeightPx: number;
  aiBlockWidthPx: number;
  fontSizePx: number;
  lineHeightPx: number;
  prefersReducedMotion: boolean;
};

export type DrawerChatBudget = {
  visibleLines: number;
  maxCharsPerLine: number;
  targetWordRange: [number, number];
  maxBulletItems: number;
  promptText: string;
};

const MIN_CHARS_PER_LINE = 24;
const MAX_CHARS_PER_LINE = 72;
const DEFAULT_TARGET_WORDS: [number, number] = [40, 120];
const DEFAULT_MAX_BULLETS = 4;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function computeDrawerChatBudget(input: DrawerChatDisplayInput): DrawerChatBudget {
  const lineHeight = Math.max(1, input.lineHeightPx);
  const visibleLines = Math.max(2, Math.floor(input.aiBlockMaxHeightPx / lineHeight));
  const avgCharWidth = input.fontSizePx * 0.52;
  const maxCharsPerLine = clamp(
    Math.floor(input.aiBlockWidthPx / Math.max(avgCharWidth, 1)),
    MIN_CHARS_PER_LINE,
    MAX_CHARS_PER_LINE
  );

  const snapFactor =
    input.sheetSnap === "collapsed" ? 0.85 : input.sheetSnap === "half" ? 0.95 : 1;
  const targetWordRange: [number, number] = [
    Math.round(DEFAULT_TARGET_WORDS[0] * snapFactor),
    Math.round(DEFAULT_TARGET_WORDS[1] * snapFactor),
  ];

  const promptText = [
    "[Rabbit hole drawer UI budget]",
    `Device width: ${Math.round(input.viewportWidthPx)}px; AI block: ${Math.round(input.aiBlockWidthPx)}×${Math.round(input.aiBlockMaxHeightPx)}px (${input.sheetSnap} sheet).`,
    `Target reply length: ${targetWordRange[0]}–${targetWordRange[1]} words; ~${visibleLines} visible lines at ${maxCharsPerLine} chars/line.`,
    `Use at most ${DEFAULT_MAX_BULLETS} short bullets; avoid headings, tables, and code fences.`,
  ].join("\n");

  return {
    visibleLines,
    maxCharsPerLine,
    targetWordRange,
    maxBulletItems: DEFAULT_MAX_BULLETS,
    promptText,
  };
}
