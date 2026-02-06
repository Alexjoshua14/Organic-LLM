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
];

export function getPrototypeHref(slug: string): string {
  return `/sandbox/prototypes/${slug}`;
}
