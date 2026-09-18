/**
 * Footer layout thresholds for {@link CoreInput}, measured on the prompt shell
 * (`[data-prompt-input-shell]`). Each pair is offset so the layout does not oscillate
 * when the shell sits right at a boundary.
 *
 * Read by the composer's resize observer and by the CoreInput lab
 * (`/sandbox/prototypes/core-input`) for its live layout readout.
 */
export const CORE_INPUT_LAYOUT = {
  /** Wider threshold to show text labels next to chip icons. */
  showLabelsAtPx: 640,
  /** Lower threshold to hide them again. */
  hideLabelsAtPx: 600,
  /** Narrow composer: icon chips + overflow menu for secondary tools; model/effort stay visible. */
  condensedAtPx: 600,
  /** Leave the condensed layout once the shell is at least this wide. */
  expandedAtPx: 640,
} as const;

export type CoreInputLayoutMode = "labels" | "icons" | "condensed";

/**
 * Steady-state layout for a shell width, ignoring the hysteresis band. Inside the band
 * (`hideLabelsAtPx` ≤ width < `showLabelsAtPx`) the live mode depends on the direction the
 * shell was resized from, so callers should treat the result there as approximate.
 */
export function resolveCoreInputLayoutMode(
  widthPx: number,
  variant: "default" | "compact" = "default"
): CoreInputLayoutMode {
  if (variant === "compact" || widthPx < CORE_INPUT_LAYOUT.condensedAtPx) return "condensed";
  if (widthPx >= CORE_INPUT_LAYOUT.showLabelsAtPx) return "labels";

  return "icons";
}

export function isInCoreInputHysteresisBand(widthPx: number): boolean {
  return widthPx >= CORE_INPUT_LAYOUT.hideLabelsAtPx && widthPx < CORE_INPUT_LAYOUT.showLabelsAtPx;
}
