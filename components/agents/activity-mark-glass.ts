import type { AgentDotState } from "./agent-dot-grid-motion";

export type ActivityGlassAppearance = {
  /** Material alpha; the backdrop filter itself stays fully active. */
  opacity: number;
  /** Backdrop radius in CSS pixels, bounded to the 0–14px material range. */
  blur: number;
  /** Brightness of the layers behind the cover; 1 is the unchanged baseline. */
  brightness: number;
  /** Any CSS color, including theme variables or color-mix(). */
  tint: string;
};
export type ActivityGlassByState = Partial<Record<AgentDotState, Partial<ActivityGlassAppearance>>>;

export const ACTIVITY_GLASS_MAX_BLUR = 14;

export const ACTIVITY_GLASS_TINTS = {
  neutral: "var(--background)",
  organic: "color-mix(in oklch, var(--background) 92%, var(--accent))",
  amber: "color-mix(in oklch, var(--background) 92%, #b77945)",
} as const;

const DEFAULT_ACTIVITY_GLASS: ActivityGlassAppearance = {
  opacity: 0.72,
  blur: 1.25,
  brightness: 1,
  tint: ACTIVITY_GLASS_TINTS.neutral,
};

export const ACTIVITY_GLASS_BY_STATE: Record<AgentDotState, ActivityGlassAppearance> = {
  idle: { ...DEFAULT_ACTIVITY_GLASS },
  working: { opacity: 0.28, blur: 0.5, brightness: 1.08, tint: ACTIVITY_GLASS_TINTS.organic },
  waiting: { ...DEFAULT_ACTIVITY_GLASS },
  blocked: { ...DEFAULT_ACTIVITY_GLASS, tint: ACTIVITY_GLASS_TINTS.amber },
  complete: { ...DEFAULT_ACTIVITY_GLASS },
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
