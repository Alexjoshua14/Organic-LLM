/**
 * The approved timing for AdaptiveLiquidChrome, in one place. The component's prop defaults and
 * the blog's timing demo both read it, so the post can never drift from what the background does.
 * It lives in its own file so a page can import the numbers without importing the WebGL shader.
 */
export const ADAPTIVE_CHROME_TIMING = {
  /** Dim: quick, you asked for attention. */
  dimMs: 700,
  /** Phase 1 of brightening: dimmed up to `brightenTo` (quickish, still slower than dim). */
  to65Ms: 1200,
  /** Phase 2: the slow exhale from `brightenTo` to full. */
  to100Ms: 2800,
  /** Where phase 1 ends, as a share of full opacity. */
  brightenTo: 0.65,
  /** 0.7 means the background drops to 30% opacity while dimmed. */
  dimIntensity: 0.7,
  ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
} as const;
