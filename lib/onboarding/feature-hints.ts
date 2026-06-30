/**
 * First-run coachmarks for Organic LLM.
 *
 * - Flip `FEATURE_HINTS_MASTER_SWITCH` to disable every hint in one place.
 * - Set `enabled: false` on a single hint to turn it off without removing UI wiring.
 * - Bump `version` to re-show a hint after copy changes (ignores older dismiss records).
 */

export const FEATURE_HINTS_MASTER_SWITCH = true;

export const FEATURE_HINT_IDS = [
  "experience-rail",
  "chat-empty-state",
  "noesis-sparks",
  "noesis-suggest-reply",
  "noesis-steer-assist",
  "noesis-thread-title",
  "composer-search-memory",
  "composer-auto-model",
  "rabbit-holes-focus",
  "arcadia-starters",
] as const;

export type FeatureHintId = (typeof FEATURE_HINT_IDS)[number];

export type FeatureHintSide = "top" | "bottom" | "left" | "right";

export type FeatureHintDefinition = {
  id: FeatureHintId;
  /** Per-hint kill switch for developers. Defaults to on for new features. */
  enabled: boolean;
  title: string;
  body: string;
  /** Increment when title/body changes to surface the hint again for users who dismissed an older version. */
  version: number;
  side?: FeatureHintSide;
  align?: "start" | "center" | "end";
  /** On narrow viewports, pin as bottom sheet instead of anchoring. */
  mobileBottomSheet?: boolean;
};

export const FEATURE_HINTS: Record<FeatureHintId, FeatureHintDefinition> = {
  "experience-rail": {
    id: "experience-rail",
    enabled: true,
    title: "Switch surfaces",
    body: "Chat, Arcadia, Noesis, Strata, Rabbit Holes, Ergon, and Remy — one rail for the whole workspace.",
    version: 1,
    side: "bottom",
    align: "start",
    mobileBottomSheet: true,
  },
  "chat-empty-state": {
    id: "chat-empty-state",
    enabled: true,
    title: "You're ready",
    body: "Type below to begin. Search and Memory are already on — toggle them in the composer anytime.",
    version: 1,
    side: "top",
    align: "center",
    mobileBottomSheet: true,
  },
  "noesis-sparks": {
    id: "noesis-sparks",
    enabled: true,
    title: "Sparks",
    body: "Memory-informed starters to open a thread. Pick one or type your own below.",
    version: 1,
    side: "bottom",
    align: "start",
    mobileBottomSheet: true,
  },
  "noesis-suggest-reply": {
    id: "noesis-suggest-reply",
    enabled: true,
    title: "Suggest my reply",
    body: "Drafts your next message from the conversation. Edit before sending, Shift+click to send immediately, or use Send suggestion.",
    version: 1,
    side: "top",
    align: "start",
    mobileBottomSheet: true,
  },
  "noesis-steer-assist": {
    id: "noesis-steer-assist",
    enabled: true,
    title: "Steer assist",
    body: "Shape how reply suggestions should sound — notes feed Suggest my reply, not the chat. ⌘/Ctrl+Enter runs steer on your draft.",
    version: 1,
    side: "top",
    align: "end",
    mobileBottomSheet: true,
  },
  "noesis-thread-title": {
    id: "noesis-thread-title",
    enabled: true,
    title: "Thread title",
    body: "When the sidebar is collapsed, the thread title stays visible here so you keep context while reading.",
    version: 1,
    side: "bottom",
    align: "start",
  },
  "composer-search-memory": {
    id: "composer-search-memory",
    enabled: true,
    title: "Search & Memory",
    body: "Search and Memory are on by default — web results and your memory layer inform each turn. Toggle anytime.",
    version: 1,
    side: "top",
    align: "start",
    mobileBottomSheet: true,
  },
  "composer-auto-model": {
    id: "composer-auto-model",
    enabled: true,
    title: "Auto model",
    body: "Auto picks a fast or reasoning model per message. Choose a fixed model here when you want full control.",
    version: 1,
    side: "top",
    align: "start",
    mobileBottomSheet: true,
  },
  "rabbit-holes-focus": {
    id: "rabbit-holes-focus",
    enabled: true,
    title: "Focus mode",
    body: "⌘⇧F (Ctrl+Shift+F) hides the path and prompt so you can read nodes and sources without distraction.",
    version: 1,
    side: "top",
    align: "center",
    mobileBottomSheet: true,
  },
  "arcadia-starters": {
    id: "arcadia-starters",
    enabled: true,
    title: "Arcadia starters",
    body: "Pick a prompt chip to begin — Arcadia favors concise, tool-forward replies on the same thread spine as main chat.",
    version: 1,
    side: "bottom",
    align: "start",
    mobileBottomSheet: true,
  },
};

export function getFeatureHint(id: FeatureHintId): FeatureHintDefinition {
  return FEATURE_HINTS[id];
}

export function isFeatureHintEnabledInCode(id: FeatureHintId): boolean {
  if (!FEATURE_HINTS_MASTER_SWITCH) return false;

  return FEATURE_HINTS[id]?.enabled ?? false;
}
