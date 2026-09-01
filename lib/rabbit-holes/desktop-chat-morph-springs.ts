import { regular_spring_config, type SpringConfig } from "@organic-llm/morph-physics";

/** Snappy springs for rabbit-hole desktop chat open/close morphs. */
export const RABBIT_HOLE_DESKTOP_CHAT_SPRING: SpringConfig = {
  ...regular_spring_config,
  stiffness: 520,
  damping: 42,
  mass: 1,
  precision: 0.4,
};

export const RABBIT_HOLE_COMPOSER_MORPH_SPRING: SpringConfig = {
  ...RABBIT_HOLE_DESKTOP_CHAT_SPRING,
  stiffness: 480,
  damping: 44,
};
