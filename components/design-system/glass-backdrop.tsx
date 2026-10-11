"use client";

import type { ComponentProps } from "react";

import { useEffect, useId, useState } from "react";

import { OrganicGlassRefractFilterSvg } from "./organic-glass-refract-filter";

import { cn } from "@/lib/utils";
import { getSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";

// Broad, static bends; keep the two-octave noise out of the animation loop.
export type GlassDistortionSettings = {
  /** Displacement distance in CSS pixels. */
  strength: number;
  /** Spatial frequency of the static fractal noise. */
  frequency: number;
  /** Blur radius of the displacement map, not the backdrop. */
  softness: number;
};
export const GLASS_DISTORTION_DEFAULTS: GlassDistortionSettings = {
  strength: 6,
  frequency: 0.035,
  softness: 2.5,
};
export const GLASS_DISTORTION_BOUNDS = {
  strength: [0, 20],
  frequency: [0.005, 0.12],
  softness: [0, 5],
} as const;

function distortionValue(key: keyof GlassDistortionSettings, value?: number): number {
  const [min, max] = GLASS_DISTORTION_BOUNDS[key];

  return value !== undefined && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : GLASS_DISTORTION_DEFAULTS[key];
}
const DISTORTION_PREFERENCES = [
  "(prefers-reduced-motion: reduce)",
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
] as const;

export type GlassBackdropProps = ComponentProps<"div"> & {
  /** Refract this owned background beneath a separate glass() cover. Off by default. */
  distortion?: boolean;
  /** Optional tuning, bounded to the prototype's safe material ranges. */
  distortionSettings?: Partial<GlassDistortionSettings>;
};

/** Safari-compatible refraction of owned background content, leaving foreground UI untouched. */
export function GlassBackdrop({
  distortion = false,
  distortionSettings,
  children,
  className,
  style,
  ...props
}: GlassBackdropProps) {
  const filterId = `organic-glass-distortion-${useId().replace(/:/g, "")}`;
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (!distortion) {
      setEligible(false);

      return;
    }
    const preferences: MediaQueryList[] = [];
    const sync = () => {
      try {
        setEligible(
          window.CSS?.supports("filter", "url(#glass-filter)") === true &&
            !preferences.some((preference) => preference.matches) &&
            !getSettings().lightweightMode
        );
      } catch {
        setEligible(false);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === USER_SETTINGS_STORAGE_KEY || event.key === null) sync();
    };

    try {
      for (const query of DISTORTION_PREFERENCES) {
        preferences.push(window.matchMedia(query));
      }
    } catch {
      setEligible(false);

      return;
    }
    sync();
    for (const preference of preferences) preference.addEventListener("change", sync);
    window.addEventListener("organic-llm-settings", sync);
    window.addEventListener("storage", storage);

    return () => {
      for (const preference of preferences) preference.removeEventListener("change", sync);
      window.removeEventListener("organic-llm-settings", sync);
      window.removeEventListener("storage", storage);
    };
  }, [distortion]);

  const active = distortion && eligible;
  const existingFilter = style?.filter && style.filter !== "none" ? `${style.filter} ` : "";

  return (
    <div
      {...props}
      className={cn(className, active && "organic-glass-distorted-backdrop")}
      data-glass-distortion={active ? "on" : "off"}
      style={active ? { ...style, filter: `${existingFilter}url("#${filterId}")` } : style}
    >
      {active ? (
        <OrganicGlassRefractFilterSvg
          baseFrequency={distortionValue("frequency", distortionSettings?.frequency)}
          id={filterId}
          scale={distortionValue("strength", distortionSettings?.strength)}
          softness={distortionValue("softness", distortionSettings?.softness)}
        />
      ) : null}
      {children}
    </div>
  );
}
