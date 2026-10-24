import { regular_spring_config, type SpringConfig } from "@organic-llm/morph-physics";

export const MORPH_DEMO_SPEEDS = [25, 50, 75, 100] as const;
export type MorphDemoSpeedPercent = (typeof MORPH_DEMO_SPEEDS)[number];

/**
 * Demo-only spring retuning: lower `playbackPercent` runs the morph more slowly so it is easier
 * to inspect. 100% matches {@link regular_spring_config}.
 */
export function morphSpringConfigForPlaybackPercent(percent: MorphDemoSpeedPercent): SpringConfig {
  const t = percent / 100;
  const b = regular_spring_config;

  return {
    ...b,
    stiffness: b.stiffness * t,
    mass: b.mass / t,
  };
}
