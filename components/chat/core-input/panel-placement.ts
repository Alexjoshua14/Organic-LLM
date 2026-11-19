/**
 * Where CoreInput's floating panels (the settings panel, the slash menu) sit: above the prompt
 * shell, tucked under its top edge, inside the panel slot.
 */

/**
 * How far a panel tucks under the top of the shell: half of the compact row's 8px padding
 * (`--spacing-inset-sm`), which is `--spacing-stack-xs`. Keep it below that padding so the
 * overlap only ever covers empty shell, never a control or the text.
 */
export const PANEL_OVERLAP_PX = 4;
/** The clearance a panel keeps from the viewport's edges. */
export const PANEL_COLLISION_PADDING_PX = 16;

/**
 * On xs screens (below Tailwind's `sm` breakpoint, `--breakpoint-sm`) a panel is about as wide as
 * the composer, so it centres over it instead of hugging the left edge.
 */
export function panelAlign(): "start" | "center" {
  if (typeof window === "undefined") return "start";
  const sm =
    getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-sm").trim() ||
    "40rem";

  return window.matchMedia(`(width < ${sm})`).matches ? "center" : "start";
}
