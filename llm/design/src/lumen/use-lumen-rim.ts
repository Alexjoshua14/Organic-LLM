"use client";

/**
 * Lumen rim geometry — one measurement shared by every rim variant (chip, shell, card).
 *
 * The rim is a separate layer behind the surface, never on its fill. This hook measures the
 * surface and writes the rim's geometry as CSS variables on the host, which `lumen.css` reads.
 *
 * ## Geometry (ResizeObserver → CSS vars on the host)
 * Band spans **−3% to +10%** of min(surface width, height):
 * - `--cl-lumen-inset`  = 3% inside the surface edge
 * - `--cl-lumen-outset` = 10% outside the surface edge
 * - `--cl-lumen-band`   = inset + outset (the ring's border width)
 * - `--cl-lumen-blur`   = 11% of min dimension (soft falloff)
 * - `--cl-lumen-bleed`  = outset + blur (host padding/margin so the glow is not clipped)
 * - the radius variable = the surface's measured border radius
 *
 * ## Do not
 * - Put lumen fill on the surface itself.
 * - Replace the border ring with ellipse/circle radial gradients on wide surfaces.
 * - Stack box-shadow halos on top of the ring (creates double bands).
 */

import { useLayoutEffect, useRef, type RefObject } from "react";

/** Rim band ratios, relative to the surface's smaller side. */
export const LUMEN_RIM_RATIOS = {
  /** Inner edge of the band — inside the surface edge. */
  inset: 0.03,
  /** Outer edge of the band — outside the surface edge. */
  outset: 0.1,
  /** Soft falloff blur. */
  blur: 0.11,
} as const;

/** Which radius variable the rim reads: chips and cards share one, the shell has its own. */
export type LumenRimRadius = "chip" | "shell";

const RADIUS_VARIABLE: Record<LumenRimRadius, string> = {
  chip: "--cl-lumen-chip-radius",
  shell: "--cl-lumen-shell-radius",
};

export type LumenRimGeometry = {
  inset: number;
  outset: number;
  band: number;
  blur: number;
  bleed: number;
};

/** Rim geometry in px for a surface whose smaller side is `min` px. */
export function lumenRimGeometry(min: number): LumenRimGeometry {
  const inset = min * LUMEN_RIM_RATIOS.inset;
  const outset = min * LUMEN_RIM_RATIOS.outset;
  const blur = min * LUMEN_RIM_RATIOS.blur;

  return { inset, outset, band: inset + outset, blur, bleed: outset + blur };
}

export type UseLumenRimOptions = {
  /** Selector for the lit surface inside the host, e.g. `.composer-tool-chip`. */
  target: string;
  /** Radius variable to write. Defaults to `"chip"`. */
  radius?: LumenRimRadius;
  /** Measure only while enabled. Defaults to `true`. */
  enabled?: boolean;
  /**
   * Size the rim from the surface's first measured height, so a surface that grows (a composer
   * while typing) keeps the same glow instead of widening and blurring it into a smudge.
   */
  holdRestingHeight?: boolean;
};

/** Sync rim band metrics to the host from the measured surface. */
export function useLumenRim(
  hostRef: RefObject<HTMLElement | null>,
  { target, radius = "chip", enabled = true, holdRestingHeight = false }: UseLumenRimOptions
) {
  useLayoutEffect(() => {
    const host = hostRef.current;

    if (!host || !enabled) return;

    let restingHeight = Infinity;

    const sync = () => {
      const surface = host.querySelector<HTMLElement>(target);

      if (!surface) return;

      const { width, height } = surface.getBoundingClientRect();

      if (width < 1 || height < 1) return;
      if (holdRestingHeight && restingHeight === Infinity) restingHeight = height;

      const geometry = lumenRimGeometry(Math.min(width, height, restingHeight));

      host.style.setProperty(RADIUS_VARIABLE[radius], getComputedStyle(surface).borderRadius);
      host.style.setProperty("--cl-lumen-inset", `${geometry.inset}px`);
      host.style.setProperty("--cl-lumen-outset", `${geometry.outset}px`);
      host.style.setProperty("--cl-lumen-band", `${geometry.band}px`);
      host.style.setProperty("--cl-lumen-blur", `${geometry.blur}px`);
      host.style.setProperty("--cl-lumen-bleed", `${geometry.bleed}px`);
    };

    sync();

    const surface = host.querySelector<HTMLElement>(target);

    if (!surface) return;

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(sync);

    observer.observe(surface);

    return () => observer.disconnect();
  }, [hostRef, target, radius, enabled, holdRestingHeight]);
}

export function useLumenRimHostRef<T extends HTMLElement = HTMLSpanElement>() {
  return useRef<T>(null);
}
