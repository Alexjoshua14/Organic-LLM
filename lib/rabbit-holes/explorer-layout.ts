/**
 * Rabbit Hole explorer column layout — when the 3-col grid is allowed.
 *
 * Portrait / tall desktops shrink the main pane (sidebar still reserves width).
 * A fixed `260px_1fr_260px` grid then starves the center column down to a
 * min-content strip (one word per line on the empty state). Below the
 * threshold we stack so PATH and the empty/article column share one measure.
 *
 * Tailwind `@min-[…]` classes below must stay in sync with
 * {@link RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX} (enforced in unit tests).
 */

/** Path / sources column width (px). */
export const RABBIT_HOLE_SIDE_COLUMN_PX = 260;

/** Tailwind `gap-8` between the three explorer columns (px). */
export const RABBIT_HOLE_GRID_GAP_PX = 32;

/**
 * Minimum center-column measure (px) before enabling the 3-col grid.
 * Aligns with a readable `max-w-md` (28rem) line — chips and empty-state copy.
 */
export const RABBIT_HOLE_CENTER_MIN_MEASURE_PX = 448;

/** Stacked (narrow) max width — same measure PATH and empty state share. */
export const RABBIT_HOLE_STACK_MAX_WIDTH_CLASS = "max-w-2xl";

/** Wide shell once the 3-col grid is active. */
export const RABBIT_HOLE_WIDE_MAX_WIDTH_CLASS = "max-w-7xl";

/**
 * Content-box width the explorer `@container` must reach for 3 columns.
 * side + center min + side + two gaps.
 */
export const RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX =
  RABBIT_HOLE_SIDE_COLUMN_PX * 2 +
  RABBIT_HOLE_CENTER_MIN_MEASURE_PX +
  RABBIT_HOLE_GRID_GAP_PX * 2;

/**
 * Whether the explorer main area is wide enough for path | article | sources.
 * `mainWidthPx` is the container’s inline size (content box after padding).
 */
export function rabbitHoleUsesThreeColumnGrid(mainWidthPx: number): boolean {
  if (!Number.isFinite(mainWidthPx) || mainWidthPx <= 0) return false;

  return mainWidthPx >= RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX;
}

/**
 * Static Tailwind fragments for the explorer grid.
 * `@min-[1032px]` must equal {@link RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX}.
 */
export const rabbitHoleExplorerGrid = {
  /** Put on the scrollport that owns available width after the app sidebar. */
  container: "@container",
  display: "@min-[1032px]:grid @min-[1032px]:gap-8",
  cols: "@min-[1032px]:grid-cols-[260px_1fr_260px]",
  colsFocus: "@min-[1032px]:grid-cols-[1fr]",
  maxWidth: "max-w-2xl @min-[1032px]:max-w-7xl",
  colStart1: "@min-[1032px]:col-start-1",
  colStart2: "@min-[1032px]:col-start-2",
  colStart3: "@min-[1032px]:col-start-3",
  colSpan1: "@min-[1032px]:col-span-1",
} as const;
