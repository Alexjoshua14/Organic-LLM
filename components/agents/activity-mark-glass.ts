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
  /** Optional backdrop saturation multiplier when modulated by live intensity. */
  saturation?: number;
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
  overrides?: ActivityGlassByState | number,
  intensity?: number
): ActivityGlassAppearance {
  const resolvedOverrides =
    typeof overrides === "object" && overrides !== null ? overrides : undefined;
  const resolvedIntensity = typeof overrides === "number" ? overrides : intensity;
  const defaults = ACTIVITY_GLASS_BY_STATE[state];
  const appearance = { ...defaults, ...resolvedOverrides?.[state] };

  const baseOpacity = Number.isFinite(appearance.opacity)
    ? Math.max(0, Math.min(1, appearance.opacity))
    : defaults.opacity;
  const baseBlur = Number.isFinite(appearance.blur)
    ? Math.max(0, Math.min(ACTIVITY_GLASS_MAX_BLUR, appearance.blur))
    : defaults.blur;
  const baseBrightness = Number.isFinite(appearance.brightness)
    ? Math.max(0, Math.min(2, appearance.brightness))
    : defaults.brightness;
  const tint = appearance.tint?.trim() || defaults.tint;

  if (resolvedIntensity === undefined || !Number.isFinite(resolvedIntensity)) {
    return {
      opacity: baseOpacity,
      blur: baseBlur,
      brightness: baseBrightness,
      tint,
    };
  }

  const clamped = Math.max(0, Math.min(1, resolvedIntensity));

  return {
    opacity: Math.max(0, Math.min(1, Number((baseOpacity - clamped * 0.08).toFixed(4)))),
    blur: Math.max(
      0,
      Math.min(ACTIVITY_GLASS_MAX_BLUR, Number((baseBlur + clamped * 0.35).toFixed(4)))
    ),
    brightness: Math.max(0, Math.min(2, Number((baseBrightness + clamped * 0.14).toFixed(4)))),
    tint,
    saturation: Number((1.12 + clamped * 0.24).toFixed(4)),
  };
}

export type ActivityMarkGlassProfile = ActivityGlassAppearance & {
  saturation: number;
  motionScale: number;
};

/**
 * Computes the glass material profile for `OrganicActivityMark`, optionally modulated by
 * normalized processing intensity in `[0, 1]`.
 */
export function getActivityMarkGlassProfile(
  stateOrOptions:
    | AgentDotState
    | {
        state?: AgentDotState;
        overrides?: ActivityGlassByState;
        intensity?: number;
      } = "idle",
  overridesOrIntensity?: ActivityGlassByState | number,
  maybeIntensity?: number
): ActivityMarkGlassProfile {
  const state: AgentDotState =
    typeof stateOrOptions === "object" && stateOrOptions !== null
      ? (stateOrOptions.state ?? "idle")
      : stateOrOptions;
  const overrides: ActivityGlassByState | undefined =
    typeof stateOrOptions === "object" && stateOrOptions !== null
      ? stateOrOptions.overrides
      : typeof overridesOrIntensity === "object" && overridesOrIntensity !== null
        ? overridesOrIntensity
        : undefined;
  const rawIntensity: number | undefined =
    typeof stateOrOptions === "object" && stateOrOptions !== null
      ? stateOrOptions.intensity
      : typeof overridesOrIntensity === "number"
        ? overridesOrIntensity
        : maybeIntensity;

  const base = activityGlassForState(state, overrides, rawIntensity);
  const hasIntensity = rawIntensity !== undefined && Number.isFinite(rawIntensity);
  const clamped = hasIntensity ? Math.max(0, Math.min(1, rawIntensity)) : 0;

  return {
    ...base,
    saturation: base.saturation ?? 1.12,
    motionScale: hasIntensity ? Number((0.85 + clamped * 1.0).toFixed(4)) : 1,
  };
}
