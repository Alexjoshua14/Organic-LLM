/**
 * First-run coachmarks for Organic LLM.
 *
 * Pacing: see {@link FEATURE_HINT_GUIDE_POLICY} in `feature-hint-guide-policy.ts`
 * (max 4 consecutive auto coachmarks, then unobstructed UI time).
 *
 * - Flip `FEATURE_HINTS_MASTER_SWITCH` to disable every hint in one place.
 * - Set `enabled: false` on a single hint to turn it off without removing UI wiring.
 * - Bump `version` to re-show a hint after copy changes (ignores older dismiss records).
 */

export { FEATURE_HINT_GUIDE_POLICY, MAX_CONSECUTIVE_AUTO_FEATURE_HINTS } from "./feature-hint-guide-policy";

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
  "arcadia-style-standard",
  "arcadia-style-ergon",
  "arcadia-style-scribe",
] as const;

export type FeatureHintId = (typeof FEATURE_HINT_IDS)[number];

export type FeatureHintSide = "top" | "bottom" | "left" | "right";

export type FeatureHintPresentation = "spotlight" | "toast";

export type FeatureHintBackdrop = "dim" | "blur";

export type FeatureHintDefinition = {
  id: FeatureHintId;
  /** Per-hint kill switch for developers. Defaults to on for new features. */
  enabled: boolean;
  title: string;
  body: string;
  /** Increment when title/body changes to surface the hint again for users who dismissed an older version. */
  version: number;
  /** Spotlight + anchored popover (desktop) or bottom drawer (mobile). Toast = Sonner only. */
  presentation: FeatureHintPresentation;
  side?: FeatureHintSide;
  align?: "start" | "center" | "end";
  /** Only eligible when pathname starts with this prefix. */
  pathPrefix?: string;
  /** Wait until route transition settles before showing (surface entry hints). */
  deferUntilNavigationSettled?: boolean;
  /** Blurred backdrop outside spotlight so surrounding UI stays readable. */
  contextualBackdrop?: FeatureHintBackdrop;
  /** Persisted dismissals still apply during Settings → replay tips (nav/composer chrome). */
  respectDismissInReplay?: boolean;
};

export const FEATURE_HINTS: Record<FeatureHintId, FeatureHintDefinition> = {
  "experience-rail": {
    id: "experience-rail",
    enabled: true,
    title: "Switch surfaces",
    body: "Each segment is a different workspace. Same account — different job.",
    version: 3,
    presentation: "spotlight",
    side: "bottom",
    align: "start",
    respectDismissInReplay: true,
  },
  "chat-empty-state": {
    id: "chat-empty-state",
    enabled: true,
    title: "You're ready",
    body: "Search and Memory are already on in the composer below — type to begin.",
    version: 2,
    presentation: "toast",
  },
  "noesis-sparks": {
    id: "noesis-sparks",
    enabled: true,
    title: "Sparks",
    body: "Memory-informed starters to open a thread. Pick one or type your own below.",
    version: 3,
    presentation: "spotlight",
    side: "bottom",
    align: "start",
    pathPrefix: "/sandbox/topic-explore",
    deferUntilNavigationSettled: true,
    contextualBackdrop: "blur",
  },
  "noesis-suggest-reply": {
    id: "noesis-suggest-reply",
    enabled: true,
    title: "Suggest my reply",
    body: "Drafts your next message from the conversation. Edit before sending, Shift+click to send immediately, or use Send suggestion.",
    version: 2,
    presentation: "spotlight",
    side: "top",
    align: "start",
    pathPrefix: "/sandbox/topic-explore",
    deferUntilNavigationSettled: true,
  },
  "noesis-steer-assist": {
    id: "noesis-steer-assist",
    enabled: true,
    title: "Steer assist",
    body: "Shape how reply suggestions should sound — notes feed Suggest my reply, not the chat. ⌘/Ctrl+Enter runs steer on your draft.",
    version: 2,
    presentation: "spotlight",
    side: "top",
    align: "end",
    pathPrefix: "/sandbox/topic-explore",
    deferUntilNavigationSettled: true,
  },
  "noesis-thread-title": {
    id: "noesis-thread-title",
    enabled: true,
    title: "Thread title",
    body: "When the sidebar is collapsed, the thread title stays visible here so you keep context while reading.",
    version: 2,
    presentation: "spotlight",
    side: "bottom",
    align: "start",
    pathPrefix: "/sandbox/topic-explore",
    deferUntilNavigationSettled: true,
  },
  "composer-search-memory": {
    id: "composer-search-memory",
    enabled: true,
    title: "Search & Memory",
    body: "Search and Memory are on by default — web results and your memory layer inform each turn. Toggle anytime.",
    version: 2,
    presentation: "spotlight",
    side: "top",
    align: "start",
    respectDismissInReplay: true,
  },
  "composer-auto-model": {
    id: "composer-auto-model",
    enabled: true,
    title: "Auto model",
    body: "Auto picks a fast or reasoning model per message. Choose a fixed model here when you want full control.",
    version: 2,
    presentation: "spotlight",
    side: "top",
    align: "start",
    respectDismissInReplay: true,
  },
  "rabbit-holes-focus": {
    id: "rabbit-holes-focus",
    enabled: true,
    title: "Focus mode",
    body: "⌘⇧F (Ctrl+Shift+F) hides the path and prompt so you can read nodes and sources without distraction.",
    version: 2,
    presentation: "toast",
    pathPrefix: "/rabbitholes",
    deferUntilNavigationSettled: true,
  },
  "arcadia-starters": {
    id: "arcadia-starters",
    enabled: true,
    title: "Arcadia styles",
    body: "Three ways to work — Standard, Ergon board, and Scribe. Pick one, then a starter chip below.",
    version: 4,
    presentation: "spotlight",
    side: "bottom",
    align: "start",
    pathPrefix: "/sandbox/arcadia",
    deferUntilNavigationSettled: true,
    contextualBackdrop: "blur",
  },
  "arcadia-style-standard": {
    id: "arcadia-style-standard",
    enabled: true,
    title: "Standard",
    body: "Flexible Arcadia chat — concise replies, tools when useful, structured blocks for lists and steps.",
    version: 1,
    presentation: "spotlight",
    side: "bottom",
    align: "center",
    pathPrefix: "/sandbox/arcadia",
    deferUntilNavigationSettled: true,
    contextualBackdrop: "blur",
  },
  "arcadia-style-ergon": {
    id: "arcadia-style-ergon",
    enabled: true,
    title: "Ergon board",
    body: "The assistant keeps a kanban board in-thread. Ask what's in progress, blocked, or next — starter chips tune to board work.",
    version: 1,
    presentation: "spotlight",
    side: "bottom",
    align: "center",
    pathPrefix: "/sandbox/arcadia",
    deferUntilNavigationSettled: true,
    contextualBackdrop: "blur",
  },
  "arcadia-style-scribe": {
    id: "arcadia-style-scribe",
    enabled: true,
    title: "Scribe",
    body: "Organizes your words only — no web search or invented facts. Paste a draft or outline and ask for structure.",
    version: 1,
    presentation: "spotlight",
    side: "bottom",
    align: "center",
    pathPrefix: "/sandbox/arcadia",
    deferUntilNavigationSettled: true,
    contextualBackdrop: "blur",
  },
};

export function getFeatureHint(id: FeatureHintId): FeatureHintDefinition {
  return FEATURE_HINTS[id];
}

export function isFeatureHintEnabledInCode(id: FeatureHintId): boolean {
  if (!FEATURE_HINTS_MASTER_SWITCH) return false;

  return FEATURE_HINTS[id]?.enabled ?? false;
}
