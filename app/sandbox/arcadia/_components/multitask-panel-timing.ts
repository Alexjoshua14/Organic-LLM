/**
 * Multitask panel slide / focus-width motion — next to the effect.
 * Exits clear faster than entrances (docs/design/README.md principle 2).
 */

/** Panel slide enter (Ctrl+Q / Ctrl+W show). */
export const MULTITASK_PANEL_ENTER_MS = 280;

/** Panel slide exit — faster than enter. */
export const MULTITASK_PANEL_EXIT_MS = 160;

/** Focus-share width settle when the active thread changes. */
export const MULTITASK_FOCUS_WIDTH_MS = 220;

export const MULTITASK_PANEL_EASE = [0.25, 0.46, 0.45, 0.94] as const;
