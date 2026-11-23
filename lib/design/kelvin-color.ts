import { kelvinToCss } from "@coalescence-labs/design/lumen";

import type { ContextBudgetSegmentId } from "@/lib/chat/context-budget";

export {
  LUMEN_KELVIN_BASE,
  LUMEN_KELVIN_DEEP,
  LUMEN_KELVIN_RIM,
  kelvinToCss,
  kelvinToRgb,
} from "@coalescence-labs/design/lumen";

/** Context charts span candlelight amber through daylight white to icy blue. */
export const CONTEXT_KELVIN_WARM = 1_500;
/** Cool daylight — spacious context headroom. */
export const CONTEXT_KELVIN_HEADROOM = 12_000;
/** Blue-white stress — context window nearly saturated. */
export const CONTEXT_KELVIN_CRITICAL = 30_000;

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));

  return t * t * (3 - 2 * t);
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
