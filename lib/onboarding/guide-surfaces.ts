/**
 * Surfaces listed in Guide → Start here, in sidebar order. Separate from `EXPERIENCE_SURFACES`,
 * which drives the public blog: adding a surface here must not create a blog page, and the Guide
 * links into the app, not to articles.
 *
 * `href` for thread-creating routes (`/chat`, `/sandbox/arcadia`) must be rendered with
 * `threadEntryPrefetch(href)` so a prefetch never creates a thread.
 */
export type GuideSurface = {
  id: string;
  label: string;
  /** One line: what you would open it for. */
  summary: string;
  href: string;
  /** Unfinished surfaces whose routes are admin-only. */
  adminOnly?: boolean;
};

export const GUIDE_SURFACES: GuideSurface[] = [
  {
    id: "chat",
    label: "Chat",
    summary: "Everyday conversations, with more room for research and memory.",
    href: "/chat",
  },
  {
    id: "arcadia",
    label: "Arcadia",
    summary:
      "Quick answers with tools for tasks, meal planning, or writing. You can also work with a team of agents.",
    href: "/sandbox/arcadia",
  },
  {
    id: "rabbit-holes",
    label: "Rabbit Holes",
    summary: "Branching research: cited articles you can follow deeper and resume.",
    href: "/rabbitholes/browse",
  },
  {
    id: "remy",
    label: "Remy",
    summary: "Your cooking companion: a weekly meal plan, recipes and a shopping list.",
    href: "/remy",
  },
  {
    id: "ergon",
    label: "Ergon",
    summary: "A keyboard-first task list for things that outlive a chat.",
    href: "/ergon",
  },
  {
    id: "speak",
    label: "Speak",
    summary: "Talk with Organic out loud, with visuals when they help.",
    href: "/speak",
  },
  {
    id: "noesis",
    label: "Noesis",
    summary: "Explore one topic with sparks and reply suggestions.",
    href: "/sandbox/topic-explore",
    adminOnly: true,
  },
  {
    id: "strata",
    label: "Strata",
    summary: "Turn rough notes into structured sections on a canvas.",
    href: "/sandbox/prototypes/strata",
    adminOnly: true,
  },
  {
    id: "stage",
    label: "Stage",
    summary: "A space to think and make things with Organic.",
    href: "/stage",
    adminOnly: true,
  },
];

export function guideSurfaces(options: { isAdmin: boolean }): GuideSurface[] {
  return GUIDE_SURFACES.filter((surface) => !surface.adminOnly || options.isAdmin);
}
