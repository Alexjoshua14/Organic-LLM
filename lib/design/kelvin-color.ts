import type { ContextBudgetSegmentId } from "@/lib/chat/context-budget";

/** Lumen family anchors from `styles/globals.css` (blackbody reference). */
export const LUMEN_KELVIN_DEEP = 2_800;
export const LUMEN_KELVIN_BASE = 3_000;
export const LUMEN_KELVIN_RIM = 3_200;

/** Context charts span candlelight amber through daylight white to icy blue. */
export const CONTEXT_KELVIN_WARM = 1_500;
/** Cool daylight — spacious context headroom. */
export const CONTEXT_KELVIN_HEADROOM = 12_000;
/** Blue-white stress — context window nearly saturated. */
export const CONTEXT_KELVIN_CRITICAL = 30_000;

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

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));

  return t * t * (3 - 2 * t);
}

export function kelvinToCss(kelvin: number, alpha = 1): string {
  const { r, g, b } = kelvinToRgb(kelvin);

  return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Overall context pressure — amber → blue as fill rises. */
export function contextFillKelvin(fillRatio: number): number {
  const eased = smoothstep(fillRatio);

  return CONTEXT_KELVIN_WARM + eased * (CONTEXT_KELVIN_CRITICAL - CONTEXT_KELVIN_WARM);
}

/** One ordered usage signal, separate from the categorical source colors. */
export function contextUsageLabelColor(fillRatio: number): string {
  const amberShare = smoothstep(fillRatio) * 100;

  return `color-mix(in oklab, var(--foreground) ${100 - amberShare}%, var(--context-usage-amber) ${amberShare}%)`;
}

const SEGMENT_BASE_KELVIN: Record<Exclude<ContextBudgetSegmentId, "free">, number> = {
  messages: 1_500,
  tool_output: 2_200,
  draft: 3_200,
  system: 6_500,
  tools: 10_000,
  summary: 17_000,
  memory: 30_000,
};

/** Temperature-inspired accents with more separation than literal blackbody RGB. */
const CONTEXT_SEGMENT_RGB: Record<Exclude<ContextBudgetSegmentId, "free">, string> = {
  messages: "242 181 68",
  tool_output: "237 117 64",
  draft: "242 221 130",
  system: "213 225 235",
  tools: "81 201 222",
  summary: "164 147 244",
  memory: "94 143 230",
};

export function contextSegmentColor(
  segmentId: ContextBudgetSegmentId,
  fillRatio: number,
  alpha = 1
): string {
  if (segmentId === "free") return kelvinToCss(contextSegmentKelvin(segmentId, fillRatio), alpha);

  const rgb = CONTEXT_SEGMENT_RGB[segmentId];

  return alpha === 1 ? `rgb(${rgb})` : `rgb(${rgb} / ${alpha})`;
}

/** Stable source colors, so a section keeps its identity across sends. */
export function contextSegmentKelvin(segmentId: ContextBudgetSegmentId, fillRatio: number): number {
  if (segmentId === "free") {
    const headroom = 1 - Math.min(1, Math.max(0, fillRatio));

    return CONTEXT_KELVIN_HEADROOM + headroom * (CONTEXT_KELVIN_CRITICAL - CONTEXT_KELVIN_HEADROOM);
  }

  return SEGMENT_BASE_KELVIN[segmentId];
}

/** Position along the filled arc (0 = first segment, 1 = last) → blackbody K. */
export function contextArcKelvin(arcPosition: number, fillRatio: number): number {
  const start = CONTEXT_KELVIN_WARM;
  const end = contextFillKelvin(fillRatio);
  const t = smoothstep(arcPosition);

  return start + (end - start) * t;
}
