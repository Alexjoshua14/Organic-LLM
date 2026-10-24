/**
 * Memory ingest shell layout: fixed dock band sized to the composer **at rest**
 * (prompt header + 1 body row + footer/tools). Tray, chips, and the composer are
 * bottom-anchored in an absolute overlay inside the band, so growth (multiline
 * typing, chips, session tray) extends upward *over* the particle scene instead of
 * reflowing it. The band never changes height, so the particle column and caption
 * budget stay stable.
 *
 * Resting budget (md+): sticky `pt-1` + prompt header + 1 body row (`md:text-sm`)
 * + footer/tools + `sm:pb-4`. Default breakpoint uses `text-base` body (taller).
 *
 * Tailwind classes are literals so JIT can extract them.
 */
export const memoryIngestDockBandHeightClass = "h-[8.875rem] md:h-[8.5rem]";

/** Dock band resting height at default breakpoint (8.875rem). */
export const MEMORY_INGEST_DOCK_HEIGHT_REM = 8.875;

/** Dock band resting height at md+ (8.5rem). */
export const MEMORY_INGEST_DOCK_HEIGHT_MD_REM = 8.5;

/** Shell top padding (pt-6). */
export const MEMORY_INGEST_SHELL_TOP_PADDING_REM = 1.5;

/** Caption vertical margin (mt-2 + mb-2). */
export const MEMORY_INGEST_CAPTION_MARGIN_REM = 1;

/** Particle column minimum reserve (matches ParticleField minHeight intent). */
export const MEMORY_INGEST_PARTICLE_MIN_RESERVE_VH = 0.42;
export const MEMORY_INGEST_PARTICLE_MIN_RESERVE_PX = 360;

/**
 * Desktop (md+) reserves more vertical space for the particle field so it stays
 * the primary visual feature. This shrinks the assistant caption's share, which
 * suits Delphi's terse replies; the caption still scrolls when it needs to.
 */
export const MEMORY_INGEST_PARTICLE_MIN_RESERVE_DESKTOP_VH = 0.54;
export const MEMORY_INGEST_PARTICLE_MIN_RESERVE_DESKTOP_PX = 620;

export function getMemoryIngestDockHeightPx(rootFontSizePx: number, isMdUp: boolean): number {
  const rem = isMdUp ? MEMORY_INGEST_DOCK_HEIGHT_MD_REM : MEMORY_INGEST_DOCK_HEIGHT_REM;

  return rem * rootFontSizePx;
}

export function getMemoryIngestParticleMinReservePx(
  viewportHeightPx: number,
  isMdUp = false
): number {
  const vhFraction = isMdUp
    ? MEMORY_INGEST_PARTICLE_MIN_RESERVE_DESKTOP_VH
    : MEMORY_INGEST_PARTICLE_MIN_RESERVE_VH;
  const cap = isMdUp
    ? MEMORY_INGEST_PARTICLE_MIN_RESERVE_DESKTOP_PX
    : MEMORY_INGEST_PARTICLE_MIN_RESERVE_PX;

  return Math.min(viewportHeightPx * vhFraction, cap);
}
