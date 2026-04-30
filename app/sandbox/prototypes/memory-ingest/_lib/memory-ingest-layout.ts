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
