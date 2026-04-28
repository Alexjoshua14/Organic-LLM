/**
 * Prototype registry — single source of truth for the gallery.
 * Add entries here to show new prototypes without touching the page layout.
 */
export type PrototypeEntry = {
  /** URL path under /sandbox/prototypes */
  slug: string;
  title: string;
  description: string;
  ranking?: {
    /** Manual priority signal for surfacing strategically important prototypes. */
    importance?: number;
    /** Starter usage signal; can be replaced by real analytics later. */
    frequency?: number;
    createdAt?: string;
    updatedAt?: string;
  };
};

export const prototypes: PrototypeEntry[] = [
  {
    slug: "background",
    title: "AdaptiveLiquidChrome",
    description:
      "Liquid chrome background that dims on hover/focus. Demo: Hover me button + text input.",
    ranking: {
      importance: 9,
      frequency: 7,
      createdAt: "2026-04-20",
      updatedAt: "2026-04-24",
    },
  },
  {
    slug: "llm-states",
    title: "LLM states",
    description:
      "All chat loading and action states (thinking, reasoning, search, memory, tool, errored) in one place for development.",
    ranking: {
      importance: 8,
      frequency: 6,
      createdAt: "2026-04-21",
      updatedAt: "2026-04-24",
    },
  },
  {
    slug: "glass-primitive",
    title: "Glass primitive",
    description:
      "Candidate Organic Glass material designed to play in tandem with AdaptiveLiquidChrome before becoming the default primitive.",
    ranking: {
      importance: 10,
      frequency: 10,
      createdAt: "2026-04-24",
      updatedAt: "2026-04-24",
    },
  },
  {
    slug: "glass-fonts",
    title: "Glass font comparison",
    description:
      "Compares Organic Glass baseline v2 across Satoshi, Inter, and Commissioner in identical columns.",
    ranking: {
      importance: 9,
      frequency: 8,
      createdAt: "2026-04-24",
      updatedAt: "2026-04-24",
    },
  },
  {
    slug: "ui-v2-snapshot",
    title: "UI v2 snapshot",
    description:
      "Side-by-side snapshot comparing current UI with a Commissioner + Organic Glass v2 direction across core surfaces.",
    ranking: {
      importance: 10,
      frequency: 9,
      createdAt: "2026-04-24",
      updatedAt: "2026-04-24",
    },
  },
  {
    slug: "line-list",
    title: "Wine line list",
    description:
      "Tell me a wine; I show a table (Wine, Style, Key Food Affinities). Editable rows, reorder, sort by category or attributes.",
    ranking: {
      importance: 5,
      frequency: 3,
      createdAt: "2026-04-22",
      updatedAt: "2026-04-22",
    },
  },
  {
    slug: "memory-ingest",
    title: "Memory ingest (particles)",
    description:
      "Ritual surface: capture a thought into memory with GPU particle state as the primary feedback channel (mobile-first).",
    ranking: {
      importance: 8,
      frequency: 4,
      createdAt: "2026-04-27",
      updatedAt: "2026-04-27",
    },
  },
  {
    slug: "strata",
    title: "Strata",
    description:
      "Transforms raw thoughts into structured, readable artifacts through layered AI orchestration.",
    ranking: {
      importance: 9,
      frequency: 6,
      createdAt: "2026-04-22",
      updatedAt: "2026-04-24",
    },
  },
];

export function getPrototypeHref(slug: string): string {
  return `/sandbox/prototypes/${slug}`;
}
