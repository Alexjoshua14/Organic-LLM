/** Multiplier on resolved foreground opacity so dense point clouds stay readable. */
export const PARTICLE_ALPHA_FROM_TOKEN = 0.28;

export type ParsedCssColor = {
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  alpha: number;
};

/**
 * Parse `getComputedStyle(...).color` — typically `rgb()` / `rgba()` even when tokens use OKLCH in CSS.
 */
export function parseCssColorToRgb01(cssColor: string): ParsedCssColor {
  const s = cssColor.trim();
  const rgba = s.match(
    /^rgba?\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*(?:,\s*(-?[\d.]+)\s*)?\)$/i
  );

  if (rgba) {
    const r = Math.min(1, Math.max(0, Number(rgba[1]) / 255));
    const g = Math.min(1, Math.max(0, Number(rgba[2]) / 255));
    const b = Math.min(1, Math.max(0, Number(rgba[3]) / 255));
    const alpha = rgba[4] !== undefined ? Math.min(1, Math.max(0, Number(rgba[4]))) : 1;

    return { r, g, b, alpha };
  }

  return { r: 0.55, g: 0.55, b: 0.55, alpha: 1 };
}

export function readForegroundProbeRgb01(probe: HTMLElement): ParsedCssColor {
  if (typeof getComputedStyle === "undefined") {
    return { r: 0.55, g: 0.55, b: 0.55, alpha: 1 };
  }

  return parseCssColorToRgb01(getComputedStyle(probe).color);
}

/** Hidden span using `text-foreground` so resolved color tracks Organic theme tokens. */
export function attachForegroundThemeProbe(container: HTMLElement): {
  element: HTMLSpanElement;
  remove: () => void;
} {
  const el = document.createElement("span");

  el.className =
    "pointer-events-none absolute left-0 top-0 z-10 h-px w-px select-none opacity-0 text-foreground";
  el.setAttribute("aria-hidden", "true");
  container.prepend(el);

  return {
    element: el,
    remove: () => {
      el.remove();
    },
  };
}
