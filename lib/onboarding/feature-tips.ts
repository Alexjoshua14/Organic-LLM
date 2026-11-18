/**
 * Feature tips: the short pointers Organic shows the first time a feature matters.
 *
 * Two kinds live here:
 *
 * - **Automatic tips** (`auto: true`) anchor to a control through `<FeatureTip id>` and may appear
 *   on their own, one at a time, under the pacing rules in `tip-pacing.ts`. Keep this list short:
 *   each one interrupts someone. Add one only for a control that is easy to miss and costly not to
 *   know about.
 * - **Guide tips** (`auto: false`) never appear on their own. They are listed in Guide → Tips so
 *   people can read them when they want to.
 *
 * Every automatic tip is also listed in the Guide, so a dismissed tip can always be found again.
 *
 * `version`: bump it only when the tip's meaning changes and people who dismissed it should see it
 * again. Wording polish keeps the version (and therefore keeps dismissals).
 *
 * See `docs/design/onboarding.md` for the interaction rules and `content/dev-docs/feature-hints.md`
 * for how to add a tip.
 */

export const FEATURE_TIPS_MASTER_SWITCH = true;

/** Tips that can appear on their own. Order is priority: earlier wins when two qualify. */
export const AUTO_FEATURE_TIP_IDS = ["composer-search-memory", "arcadia-multiagent"] as const;

export type AutoFeatureTipId = (typeof AUTO_FEATURE_TIP_IDS)[number];

export type FeatureTipSide = "top" | "bottom" | "left" | "right";

export type FeatureTipAudience = "everyone" | "admin";

export type FeatureTipPlatformNote = {
  /** Shown only on Apple platforms, where the binding is safe (see `appleOnly` in shortcuts). */
  apple: string;
};

export type FeatureTipDefinition = {
  id: string;
  title: string;
  body: string;
  /** Extra sentence appended on Apple platforms only. */
  platformNote?: FeatureTipPlatformNote;
  /** Where the tip applies, for the Guide list ("In the composer"). */
  where: string;
  audience: FeatureTipAudience;
};

export type AutoFeatureTipDefinition = FeatureTipDefinition & {
  id: AutoFeatureTipId;
  auto: true;
  enabled: boolean;
  version: number;
  side: FeatureTipSide;
  align: "start" | "center" | "end";
  /** Only eligible on routes under this prefix. */
  pathPrefix?: string;
};

export type GuideOnlyTipDefinition = FeatureTipDefinition & { auto: false };

export const AUTO_FEATURE_TIPS: Record<AutoFeatureTipId, AutoFeatureTipDefinition> = {
  "composer-search-memory": {
    id: "composer-search-memory",
    auto: true,
    enabled: true,
    // Kept at the pre-redesign version so earlier dismissals still count.
    version: 2,
    title: "What informs each reply",
    body: "Search adds fresh web results. Memory adds what Organic has learned about you. Both are on by default; turn either off for the next message.",
    where: "Composer · Chat and Arcadia",
    audience: "everyone",
    side: "top",
    align: "start",
  },
  "arcadia-multiagent": {
    id: "arcadia-multiagent",
    auto: true,
    enabled: true,
    version: 1,
    title: "Choose who hears you",
    body: "Click the agent's name to pick who gets your next message: the orchestrator coordinates the team, or message one subagent directly. Your draft stays put.",
    platformNote: {
      apple: "Control-Q shows or hides the chat; Control-W shows or hides the agent board.",
    },
    where: "Arcadia · Multiagent",
    audience: "everyone",
    side: "bottom",
    align: "start",
    pathPrefix: "/sandbox/arcadia",
  },
};

/** Read-on-demand tips for Guide → Tips. Never shown automatically. */
export const GUIDE_ONLY_TIPS: GuideOnlyTipDefinition[] = [
  {
    id: "guide-surfaces",
    auto: false,
    title: "Every surface is in the sidebar",
    body: "The tiles at the top of the sidebar switch between surfaces: Chat for everyday threads, Arcadia for fast tool-forward answers, Rabbit Holes for research, Remy for meal plans, Ergon for tasks and Speak for voice.",
    where: "Sidebar",
    audience: "everyone",
  },
  {
    id: "guide-switch-ideas",
    auto: false,
    title: "Jump between ideas",
    body: "Press ⌘K (Ctrl+K on Windows and Linux) from anywhere, even mid-draft, to reopen a recent thread or start something new.",
    where: "Everywhere",
    audience: "everyone",
  },
  {
    id: "guide-auto-model",
    auto: false,
    title: "Auto picks the model",
    body: "Auto chooses a fast or a reasoning model for each message. Pick a specific model in the composer when you want the same one every time.",
    where: "Composer",
    audience: "everyone",
  },
  {
    id: "guide-rabbit-focus",
    auto: false,
    title: "Read without the chrome",
    body: "In a rabbit hole, ⌘⇧F (Ctrl+Shift+F) hides the path, sources and prompt so you can read the article on its own. Press it again to bring them back.",
    where: "Rabbit Holes",
    audience: "everyone",
  },
  {
    id: "guide-noesis-suggest",
    auto: false,
    title: "Suggest my reply",
    body: "Drafts your next message from the conversation so you can edit it before sending. Shift+click sends it immediately.",
    where: "Noesis",
    audience: "admin",
  },
  {
    id: "guide-noesis-tune",
    auto: false,
    title: "Tune",
    body: "Notes in Tune shape how suggestions sound; they feed Suggest my reply, not the chat. ⌘Enter (Ctrl+Enter) runs Tune on your draft.",
    where: "Noesis",
    audience: "admin",
  },
];

export function isAutoFeatureTipId(id: string): id is AutoFeatureTipId {
  return (AUTO_FEATURE_TIP_IDS as readonly string[]).includes(id);
}

export function getAutoFeatureTip(id: AutoFeatureTipId): AutoFeatureTipDefinition {
  return AUTO_FEATURE_TIPS[id];
}

export function isAutoFeatureTipEnabled(id: AutoFeatureTipId): boolean {
  return FEATURE_TIPS_MASTER_SWITCH && AUTO_FEATURE_TIPS[id].enabled;
}

/** Tip body with the Apple-only sentence appended where it applies. */
export function featureTipBody(tip: FeatureTipDefinition, apple: boolean): string {
  return apple && tip.platformNote ? `${tip.body} ${tip.platformNote.apple}` : tip.body;
}

/** Every tip for Guide → Tips, automatic ones first, filtered by audience. */
export function guideTipList(options: { isAdmin: boolean }): FeatureTipDefinition[] {
  const all: FeatureTipDefinition[] = [
    ...AUTO_FEATURE_TIP_IDS.map((id) => AUTO_FEATURE_TIPS[id]),
    ...GUIDE_ONLY_TIPS,
  ];

  return all.filter((tip) => tip.audience === "everyone" || options.isAdmin);
}
