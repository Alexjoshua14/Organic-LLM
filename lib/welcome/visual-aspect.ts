/** Matches current welcome screenshots in `public/images/` (3024×1542). */
export const welcomeScreenshotRatio = 3024 / 1542;

export const welcomeVisualAspect = {
  /** Technical highlights */
  highlight: welcomeScreenshotRatio,
  /** Features bento */
  feature: welcomeScreenshotRatio,
} as const;

export type WelcomeVisualAspectKey = keyof typeof welcomeVisualAspect;

/** Max width caps — ratio is preserved; height scales with width. */
export const welcomeVisualMaxWidth = {
  /** Tech highlight rows — up to ~512px wide on large screens */
  highlight: "w-full max-w-[24rem] sm:max-w-[28rem] lg:max-w-[32rem]",
  /** Compact feature bento (unused slots) */
  feature: "w-full max-w-[14rem] sm:max-w-[16rem]",
  /** Full column width in chat mode grid + feature cards */
  mode: "w-full max-w-none",
} as const;

/** Hint for Next/Image — request enough pixels for 2× retina at each breakpoint. */
export const welcomeVisualImageSizes = {
  highlight: "(max-width: 640px) 90vw, (max-width: 1024px) 448px, 512px",
  feature: "(max-width: 640px) 45vw, 320px",
  mode: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 720px",
} as const;

export type WelcomeVisualSizeKey = keyof typeof welcomeVisualMaxWidth;

/** Taller frame for animated SVG / React illustrations (not wide screenshots). */
export const welcomeIllustrationRatio = 5 / 4;

/** Chat mode cards (1/3 column) — portrait enough for a 4-row starter prompt list. */
export const welcomeModeIllustrationRatio = 2 / 3;

/** Outer frame wrapper for tech highlight rows (matches `highlight` cap). */
export const welcomeHighlightFrameClass =
  "w-full shrink-0 max-w-[24rem] sm:max-w-[28rem] lg:max-w-[32rem]";
