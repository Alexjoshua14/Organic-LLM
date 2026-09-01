import { regular_spring_config, type SpringConfig } from "@organic-llm/morph-physics";

/** Intentional expand when the page regains focus in full view. */
export const fullViewComposerExpandSpring: SpringConfig = regular_spring_config;

/**
 * Obedient collapse when focus leaves Organic LLM (browser chrome selected).
 * Tuned for ~100ms settle — snappy, not bouncy.
 */
export const fullViewComposerCollapseSpring: SpringConfig = {
  stiffness: 520,
  damping: 42,
  mass: 0.42,
  precision: 0.01,
};

export function fullViewComposerSpringForDock(next: "engaged" | "docked"): SpringConfig {
  return next === "docked" ? fullViewComposerCollapseSpring : fullViewComposerExpandSpring;
}
