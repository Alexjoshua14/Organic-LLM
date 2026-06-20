"use client";

/**
 * Composer capability chip — lumen rim backlight (canonical spec)
 *
 * Light is a separate layer behind the toggle (`.lumen-rim-backlight`), not part of
 * the glass button surface. Active state uses `glass({ chip: true })` on the button;
 * the rim provides warm underglow only in dark mode.
 *
 * ## Geometry (ResizeObserver → CSS vars on `.composer-tool-chip-host`)
 * - Band spans **−3% to +10%** of min(chip width, height):
 *   - `--lumen-inset`  = 3% inside the toggle edge
 *   - `--lumen-outset` = 10% outside the toggle edge
 *   - `--lumen-band`   = inset + outset (border width)
 * - `--lumen-blur`     = 11% of min dimension (soft falloff)
 * - `--lumen-bleed`    = outset + blur (host padding/margin so glow is not clipped)
 * - `--chip-radius`    = measured from the toggle (icon-only and labeled chips)
 *
 * ## Rendering (see `styles/globals.css`)
 * - **Rounded-rect border ring** — follows the toggle border on all four edges (not an
 *   ellipse radial gradient; wide labeled chips need the full top/bottom rim).
 * - Glow layer: `inset: -outset`, `border: var(--lumen-band) solid rgb(var(--lumen) / 0.19)`,
 *   `filter: blur(var(--lumen-blur))`.
 * - DOM: host (bleed) → stage (shrink-wrap) → glow + button.
 *
 * ## Intensity (dark mode)
 * - Active: opacity **0.36** (`.lumen-rim-backlight--on`)
 * - Active hover: **0.18** (50% reduction)
 * - Inactive hover peek: **0.18** (`.lumen-rim-backlight--hover`)
 *
 * ## Do not
 * - Put lumen fill on the button surface or use teal ghost hover in dark mode.
 * - Replace the border ring with ellipse/circle radial gradients on labeled chips.
 * - Stack box-shadow halos on top of the border ring (creates double bands).
 *
 * Tokens: `--lumen`, `--lumen-rim`, `--lumen-deep` in `styles/globals.css` (:root).
 */

import { useLayoutEffect, useRef, type RefObject } from "react";

/** Inner edge of rim band — 3% inside toggle edge (min dimension). */
const LUMEN_INSET_RATIO = 0.03;
/** Outer edge of rim band — 10% outside toggle edge (min dimension). */
const LUMEN_OUTSET_RATIO = 0.1;
/** Soft falloff blur — 11% of min dimension. */
const LUMEN_BLUR_RATIO = 0.11;

/** Sync rim band metrics to the chip host from the measured toggle button. */
export function useComposerChipLumen(hostRef: RefObject<HTMLSpanElement | null>) {
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const sync = () => {
      const button = host.querySelector<HTMLElement>(".composer-tool-chip");
      if (!button) return;

      const { width, height } = button.getBoundingClientRect();
      if (width < 1 || height < 1) return;

      const min = Math.min(width, height);
      const inset = min * LUMEN_INSET_RATIO;
      const outset = min * LUMEN_OUTSET_RATIO;
      const blur = min * LUMEN_BLUR_RATIO;

      host.style.setProperty("--chip-radius", getComputedStyle(button).borderRadius);
      host.style.setProperty("--lumen-inset", `${inset}px`);
      host.style.setProperty("--lumen-outset", `${outset}px`);
      host.style.setProperty("--lumen-band", `${inset + outset}px`);
      host.style.setProperty("--lumen-blur", `${blur}px`);
      host.style.setProperty("--lumen-bleed", `${outset + blur}px`);
    };

    sync();

    const button = host.querySelector<HTMLElement>(".composer-tool-chip");
    if (!button) return;

    const observer = new ResizeObserver(sync);
    observer.observe(button);
    return () => observer.disconnect();
  }, [hostRef]);
}

export function useComposerChipLumenHostRef() {
  return useRef<HTMLSpanElement>(null);
}
