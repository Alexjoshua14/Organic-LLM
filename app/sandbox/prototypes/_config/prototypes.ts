/**
 * Prototype registry — single source of truth for the gallery.
 * Add entries here to show new prototypes without touching the page layout.
 */
export type PrototypeEntry = {
  /** URL path under /sandbox/prototypes */
  slug: string;
  title: string;
  description: string;
};

export const prototypes: PrototypeEntry[] = [
  {
    slug: "background",
    title: "AdaptiveLiquidChrome",
    description:
      "Liquid chrome background that dims on hover/focus. Demo: Hover me button + text input.",
  },
  {
    slug: "llm-states",
    title: "LLM states",
    description:
      "All chat loading and action states (thinking, reasoning, search, memory, tool, errored) in one place for development.",
  },
  {
    slug: "line-list",
    title: "Wine line list",
    description:
      "Tell me a wine; I show a table (Wine, Style, Key Food Affinities). Editable rows, reorder, sort by category or attributes.",
  },
  {
    slug: "strata",
    title: "Strata",
    description:
      "Transforms raw thoughts into structured, readable artifacts through layered AI orchestration.",
  },
];

export function getPrototypeHref(slug: string): string {
  return `/sandbox/prototypes/${slug}`;
}
