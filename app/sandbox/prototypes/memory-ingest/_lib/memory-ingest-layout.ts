/**
 * Memory ingest shell layout: fixed dock band (composer only) so `CoreInput` height
 * changes do not steal space from the particle column. Assistant caption lives under
 * the particle field, not in this band.
 *
 * Budget (md+, no attachment strip): sticky `pt-1` + prompt header + body maxRows 5
 * (`md:text-sm`) + footer/tools + `sm:pb-4`.
 *
 * Default breakpoint uses `text-base` body (taller than `md:text-sm`).
 *
 * Tailwind classes are literals so JIT can extract them.
 */
export const memoryIngestDockBandHeightClass = "h-[14.875rem] md:h-[13.5rem]";

/** Dock band height at default breakpoint (14.875rem). */
export const MEMORY_INGEST_DOCK_HEIGHT_REM = 14.875;

/** Dock band height at md+ (13.5rem). */
export const MEMORY_INGEST_DOCK_HEIGHT_MD_REM = 13.5;

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
