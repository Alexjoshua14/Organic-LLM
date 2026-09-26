/**
 * Tall / portrait-desktop detection for the app sidebar.
 *
 * On a 24″ monitor in portrait the full-height rail feels endless while chat and
 * rabbit-hole articles benefit from the vertical space. We switch the sidebar to
 * floating and cap its height from the viewport aspect (width-linked, vh-clamped).
 */

/** Match Tailwind `md` — below this the mobile sheet sidebar is used instead. */
export const TALL_VIEWPORT_MIN_WIDTH_PX = 768;

/** Avoid floating on short desktop windows that only look “tall” by ratio. */
export const TALL_VIEWPORT_MIN_HEIGHT_PX = 880;

/** height / width — ~15% taller than square triggers tall mode. */
export const TALL_VIEWPORT_MIN_RATIO = 1.15;

/** Max height as a fraction of viewport height. */
export const TALL_SIDEBAR_MAX_VH = 0.88;

/**
 * Width multiplier for the aspect-linked cap. Keeps the rail near a landscape
 * stack height for the same width instead of stretching with portrait vh.
 */
export const TALL_SIDEBAR_WIDTH_FACTOR = 1.2;

export function isTallViewport(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width < TALL_VIEWPORT_MIN_WIDTH_PX) return false;
  if (height < TALL_VIEWPORT_MIN_HEIGHT_PX) return false;

  return height / width >= TALL_VIEWPORT_MIN_RATIO;
}

/**
 * Pixel max-height for the floating tall sidebar.
 * Prefer width × factor (aspect-linked), never above max vh of the window.
 */
export function tallSidebarMaxHeightPx(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0;
  }

  const fromWidth = width * TALL_SIDEBAR_WIDTH_FACTOR;
  const fromHeight = height * TALL_SIDEBAR_MAX_VH;

  return Math.round(Math.min(fromHeight, fromWidth));
}

/** CSS length for `--sidebar-tall-max-height`. */
export function tallSidebarMaxHeightCss(width: number, height: number): string {
  const px = tallSidebarMaxHeightPx(width, height);

  return px > 0 ? `${px}px` : `${Math.round(TALL_SIDEBAR_MAX_VH * 100)}svh`;
}
