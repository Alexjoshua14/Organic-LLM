"use client";

/**
 * Composer capability chip — lumen rim backlight (canonical spec)
 *
 * Light is a separate layer behind the toggle (`.lumen-rim-backlight`), not part of
 * the glass button surface. Active state uses `glass({ chip: true })` on the button;
 * the rim provides warm underglow only in dark mode.
 *
 * ## Geometry (`useLumenRim` from @coalescence-labs/design → CSS vars on `.composer-tool-chip-host`)
 * - Band spans **−3% to +10%** of min(chip width, height):
 *   - `--cl-lumen-inset`  = 3% inside the toggle edge
 *   - `--cl-lumen-outset` = 10% outside the toggle edge
 *   - `--cl-lumen-band`   = inset + outset (border width)
 * - `--cl-lumen-blur`     = 11% of min dimension (soft falloff)
 * - `--cl-lumen-bleed`    = outset + blur (host padding/margin so glow is not clipped)
 * - `--cl-lumen-chip-radius`    = measured from the toggle (icon-only and labeled chips)
 *
 * ## Rendering (see `llm/design/css/lumen.css`)
 * - **Rounded-rect border ring** — follows the toggle border on all four edges (not an
 *   ellipse radial gradient; wide labeled chips need the full top/bottom rim).
 * - Glow layer: `inset: -outset`, `border: var(--cl-lumen-band) solid rgb(var(--cl-lumen) / 0.19)`,
 *   `filter: blur(var(--cl-lumen-blur))`.
 * - DOM: host (bleed) → stage (shrink-wrap) → glow + button.
 *
 * ## Intensity (dark mode)
 * - Active: opacity **0.36** (`.lumen-rim-backlight--on`)
 * - Active hover: **0.18** (50% reduction)
 * - Inactive hover peek: **0.18** (`.lumen-rim-backlight--hover`)
 *
 * Concept and rules for both themes: docs/design/lumen.md
 *
 * ## Light mode (all rim-style lumen)
 * The warm rim does not read on a light surface, so there is no rim: the backlight is hidden and
 * chips, the prompt shell (`home-composer-lumen-*`, incl. the memory halo) and selected chat-style
 * cards lift with a gentle shadow of the dark theme's background (`--cl-lumen-shadow-rest` for active
 * chips, `--cl-lumen-shadow-hover` on hover; `--cl-lumen-surface-dark`, set to `--background-dark`, is the colour source).
 *
 * ## Do not
 * - Put lumen fill on the button surface or use teal ghost hover in dark mode.
 * - Replace the border ring with ellipse/circle radial gradients on labeled chips.
 * - Stack box-shadow halos on top of the border ring (creates double bands).
 *
 * Used by ComposerToolChip and composer input actions (+, mic).
 *
 * Tokens: `--cl-lumen`, `--cl-lumen-rim`, `--cl-lumen-deep` in `llm/design/css/lumen.css` (:root).
 */

import type { RefObject } from "react";

import { useLumenRim, useLumenRimHostRef } from "@coalescence-labs/design/lumen";

/** Sync rim band metrics to the chip host from the measured toggle button. */
export function useComposerChipLumen(hostRef: RefObject<HTMLSpanElement | null>) {
  useLumenRim(hostRef, { target: ".composer-tool-chip" });
}

export function useComposerChipLumenHostRef() {
  return useLumenRimHostRef();
}
