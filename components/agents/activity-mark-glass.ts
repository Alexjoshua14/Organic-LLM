import type { AgentDotState } from "./agent-dot-grid-motion";

export type ActivityGlassAppearance = {
  /** Material alpha; the backdrop filter itself stays fully active. */
  opacity: number;
  /** Backdrop radius in CSS pixels; prototype tuning supports up to 200px. */
  blur: number;
  /** Brightness of the layers behind the cover; 1 is the unchanged baseline. */
  brightness: number;
  /** Any CSS color, including theme variables or color-mix(). */
  tint: string;
};
export type ActivityGlassByState = Partial<Record<AgentDotState, Partial<ActivityGlassAppearance>>>;

export const ACTIVITY_GLASS_MAX_BLUR = 200;

export const ACTIVITY_GLASS_TINTS = {
  neutral: "var(--background)",
  organic: "color-mix(in oklch, var(--background) 92%, var(--accent))",
  amber: "color-mix(in oklch, var(--background) 92%, #b77945)",
} as const;

export const ACTIVITY_GLASS_BY_STATE: Record<AgentDotState, ActivityGlassAppearance> = {
  idle: { opacity: 0.32, blur: 10, brightness: 1, tint: ACTIVITY_GLASS_TINTS.neutral },
  working: { opacity: 0.28, blur: 4, brightness: 1.08, tint: ACTIVITY_GLASS_TINTS.organic },
  waiting: { opacity: 0.38, blur: 8, brightness: 1, tint: ACTIVITY_GLASS_TINTS.neutral },
  blocked: { opacity: 0.44, blur: 10, brightness: 0.96, tint: ACTIVITY_GLASS_TINTS.amber },
  complete: { opacity: 0.32, blur: 6, brightness: 1.04, tint: ACTIVITY_GLASS_TINTS.organic },
};

/** One state selects both layers; overrides only change the material for that state. */
export function activityGlassForState(
  state: AgentDotState,
  overrides?: ActivityGlassByState
): ActivityGlassAppearance {
  const defaults = ACTIVITY_GLASS_BY_STATE[state];
  const appearance = { ...defaults, ...overrides?.[state] };

  return {
    opacity: Number.isFinite(appearance.opacity)
      ? Math.max(0, Math.min(1, appearance.opacity))
      : defaults.opacity,
    blur: Number.isFinite(appearance.blur)
      ? Math.max(0, Math.min(ACTIVITY_GLASS_MAX_BLUR, appearance.blur))
      : defaults.blur,
    brightness: Number.isFinite(appearance.brightness)
      ? Math.max(0, Math.min(2, appearance.brightness))
      : defaults.brightness,
    tint: appearance.tint?.trim() || defaults.tint,
  };
}
