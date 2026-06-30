/** Minimum horizontal movement before a swipe is recognized (px). */
export const ERGON_SWIPE_START_PX = 8;

/** Vertical movement above this ratio of horizontal cancels the swipe (scroll wins). */
export const ERGON_SCROLL_DOMINANCE_RATIO = 1.25;

/** Right swipe past this fraction of row width -> complete (when below the active threshold). */
export const ERGON_SWIPE_COMPLETE_RATIO = 0.3;

/** Right swipe past this fraction of row width -> toggle active. */
export const ERGON_SWIPE_ACTIVE_RATIO = 0.5;

/** Left swipe past this fraction of row width -> delete. */
export const ERGON_SWIPE_DELETE_RATIO = 0.5;

/** Max gap between two taps to register a double tap (ms). */
export const ERGON_DOUBLE_TAP_MS = 280;

export type ErgonSwipeAction = "complete" | "active" | "delete" | null;

export type ErgonSwipePreview = "complete" | "active" | "delete" | null;

/** True when the gesture reads as a vertical scroll rather than a horizontal swipe. */
export function isScrollDominant(deltaX: number, deltaY: number): boolean {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < ERGON_SWIPE_START_PX) return absY >= absX;

  return absY > absX * ERGON_SCROLL_DOMINANCE_RATIO;
}

/** Live affordance hint shown behind the card while dragging. */
export function getSwipePreview(deltaX: number, rowWidth: number): ErgonSwipePreview {
  if (rowWidth <= 0) return null;

  const ratio = Math.abs(deltaX) / rowWidth;

  if (deltaX > 0) {
    if (ratio >= ERGON_SWIPE_ACTIVE_RATIO) return "active";
    if (ratio >= ERGON_SWIPE_COMPLETE_RATIO) return "complete";

    return null;
  }

  if (deltaX < 0 && ratio >= ERGON_SWIPE_DELETE_RATIO) {
    return "delete";
  }

  return null;
}

/**
 * Resolve the committed action on pointer release.
 * On right swipes the longer (active) threshold wins over the shorter (complete) one.
 */
export function resolveSwipeAction(deltaX: number, rowWidth: number): ErgonSwipeAction {
  if (rowWidth <= 0) return null;

  const ratio = deltaX / rowWidth;

  if (ratio >= ERGON_SWIPE_ACTIVE_RATIO) return "active";
  if (ratio >= ERGON_SWIPE_COMPLETE_RATIO) return "complete";
  if (ratio <= -ERGON_SWIPE_DELETE_RATIO) return "delete";

  return null;
}

/** Constrain the drag offset so the card never slides fully off-row. */
export function clampSwipeOffset(deltaX: number, rowWidth: number): number {
  const max = rowWidth * 0.65;

  return Math.max(-max, Math.min(max, deltaX));
}
