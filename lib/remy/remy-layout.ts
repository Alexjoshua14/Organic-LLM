/**
 * Remy dashboard week board layout — when the 7-day grid is allowed.
 *
 * The desktop grid needs ~64rem of inline measure (slot label + 7 day columns).
 * Below that threshold, squeezing columns makes glance cells unreadable, so days
 * stack as full-width sections instead.
 *
 * Tailwind `lg:` / `max-lg:` classes in {@link RemyWeekGrid} must stay in sync
 * with {@link REMY_WEEK_GRID_MIN_WIDTH_PX}.
 */

/** Min width (px) for the Mon–Sun week grid. Matches Tailwind `lg` (1024). */
export const REMY_WEEK_GRID_MIN_WIDTH_PX = 1024;

/** Desktop grid track: slot gutter + seven equal day columns. */
export const REMY_WEEK_GRID_COLS_CLASS = "grid-cols-[5.5rem_repeat(7,minmax(0,1fr))]";

/** Minimum content width the desktop grid assumes (rem). */
export const REMY_WEEK_GRID_MIN_WIDTH_REM = 64;

/**
 * Whether the Remy week board should use the 7-day grid.
 * `widthPx` is typically the viewport (or board container) inline size.
 */
export function remyUsesWeekGrid(widthPx: number): boolean {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return false;

  return widthPx >= REMY_WEEK_GRID_MIN_WIDTH_PX;
}
