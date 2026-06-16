/** Demo page title — editorial topic for the welcome loop. */
export const WELCOME_STRATA_PAGE_TITLE = "Why side projects stall";

/** Messy draft fragments shown in the Source notepad. */
export const WELCOME_STRATA_RAW_FRAGMENTS = [
  "• idea spark is strong",
  "• scope keeps creeping??",
  "• never clear MVP",
  "• new shiny thing every week",
  "• no audience defined",
] as const;

export const WELCOME_STRATA_RAW_TEXT = WELCOME_STRATA_RAW_FRAGMENTS.join("\n");

export const WELCOME_STRATA_REFINED_TITLE = "The stall pattern";

/** Cleaner prose after AI refinement. */
export const WELCOME_STRATA_REFINED_TEXT =
  "The idea starts with real pull, but scope grows faster than a single shippable cut. Without a defined audience or a bounded first release, momentum bleeds into the next concept before anything lands.";

export const WELCOME_STRATA_ELABORATED_HEADING = "How ideas lose momentum";

export const WELCOME_STRATA_ELABORATED_LEAD =
  "Side projects rarely fail from lack of inspiration. They stall when spark never becomes shipping discipline.";

export const WELCOME_STRATA_ELABORATED_BULLETS = [
  "Scope creep replaces a single milestone",
  "Audience stays abstract—no one to disappoint",
  "A new idea resets the clock before launch",
] as const;

export const WELCOME_STRATA_ELABORATED_CLOSING =
  "Strata turns fragments into editorial structure you can refine page by page.";

/** Full elaborated body for streaming animation. */
export const WELCOME_STRATA_ELABORATED_FULL = [
  WELCOME_STRATA_ELABORATED_HEADING,
  "",
  WELCOME_STRATA_ELABORATED_LEAD,
  "",
  ...WELCOME_STRATA_ELABORATED_BULLETS.map((item) => `• ${item}`),
  "",
  WELCOME_STRATA_ELABORATED_CLOSING,
].join("\n");

export const WELCOME_STRATA_TABS = [
  { id: "source" as const, label: "Source" },
  { id: "synthesis" as const, label: "Synthesis" },
  { id: "settings" as const, label: "Settings" },
];

export const WELCOME_STRATA_GENERATE_LABEL = "Generate";
export const WELCOME_STRATA_GENERATING_LABEL = "Working…";
