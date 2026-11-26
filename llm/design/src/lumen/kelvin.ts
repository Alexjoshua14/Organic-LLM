/** Lumen family anchors (blackbody reference for the `--cl-lumen*` tokens). */
export const LUMEN_KELVIN_DEEP = 2_800;
export const LUMEN_KELVIN_BASE = 3_000;
export const LUMEN_KELVIN_RIM = 3_200;

/**
 * Approximate blackbody RGB for UI (1000–40000K).
 * Based on Tanner Helland's color temperature algorithm.
 */
export function kelvinToRgb(kelvin: number): { r: number; g: number; b: number } {
  const k = Math.max(1_000, Math.min(40_000, kelvin)) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (k <= 66) {
    r = 255;
    g = 99.470_802_586_1 * Math.log(k) - 161.119_568_166_1;
  } else {
    r = 329.698_727_446 * (k - 60) ** -0.133_204_759_2;
    g = 288.122_169_528_3 * (k - 60) ** -0.075_514_849_2;
  }

  if (k >= 66) {
    b = 255;
  } else if (k <= 19) {
    b = 0;
  } else {
    b = 138.517_731_223_1 * Math.log(k - 10) - 305.044_792_730_7;
  }

  return {
    r: Math.round(clampChannel(r)),
    g: Math.round(clampChannel(g)),
    b: Math.round(clampChannel(b)),
  };
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, value));
}

/** CSS `rgb()` for a colour temperature, e.g. as `--cl-lumen-orb-color`. */
export function kelvinToCss(kelvin: number, alpha = 1): string {
  const { r, g, b } = kelvinToRgb(kelvin);

  return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}
