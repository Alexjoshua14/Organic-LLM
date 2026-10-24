/**
 * Which experience a sidebar thread belongs to. Drives the row's glyph — the shape is the
 * identity, so types stay legible without colour. See docs/design/sidebar-session-signals.md.
 */
export type SessionExperience =
  | "chat"
  | "arcadia"
  | "speak"
  | "rabbitHole"
  | "noesis"
  | "strata"
  | "remy"
  | "introspection"
  | "other";

/**
 * How a glyph moves while its session is working. One idiom per family of shapes, so the
 * sidebar has four motions to learn rather than one per experience.
 */
export type SessionMotionIdiom = "sweep" | "grow" | "level" | "cascade" | "breathe";

type SessionExperienceSpec = {
  /** Short noun for screen readers and the row description. */
  label: string;
  motion: SessionMotionIdiom;
};

export const SESSION_EXPERIENCES: Record<SessionExperience, SessionExperienceSpec> = {
  chat: { label: "Chat", motion: "sweep" },
  arcadia: { label: "Arcadia", motion: "sweep" },
  speak: { label: "Voice", motion: "level" },
  rabbitHole: { label: "Rabbit hole", motion: "grow" },
  noesis: { label: "Noesis", motion: "sweep" },
  strata: { label: "Strata", motion: "cascade" },
  remy: { label: "Remy", motion: "cascade" },
  introspection: { label: "Introspection", motion: "sweep" },
  other: { label: "Session", motion: "breathe" },
};

/** Maps a thread's `feature` column to the experience that owns it. */
export function getSessionExperience(feature: string | null | undefined): SessionExperience {
  const normalized = (feature ?? "").trim();

  switch (normalized) {
    case "":
    case "main":
      return "chat";
    case "arcadia":
      return "arcadia";
    // `SPEAK_THREAD_FEATURE` — not imported: that module is server-only.
    case "speak":
      return "speak";
    case "rabbit_hole":
      return "rabbitHole";
    case "topic_explore":
      return "noesis";
    case "strata_page":
    case "strata_hub":
    case "strata_agent":
      return "strata";
    case "remy_planner":
      return "remy";
    case "introspection":
      return "introspection";
    default:
      return "other";
  }
}
