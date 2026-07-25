/**
 * Prototype registry — single source of truth for the gallery and per-prototype About panels.
 * `authorThoughts` is only populated from the author's own docs — never LLM filler.
 * When thoughts are missing, `adminQuestion` surfaces a prompt visible only to admins.
 */
export type PrototypeAbout = {
  /** What this prototype is, in plain language. */
  what: string;
  /** Author's design intent — only when sourced from their notes/docs. */
  authorThoughts?: string;
  /** How to use or read this prototype. */
  howToUse?: string;
  /** Question for the project owner when author thoughts are not yet captured. */
  adminQuestion?: string;
};

export type PrototypeEntry = {
  /** URL path under /sandbox/prototypes */
  slug: string;
  title: string;
  description: string;
  about: PrototypeAbout;
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
      "Interactive lab for the liquid shader background — dim lenses, phase timing, live brightness meter, and integration snippets.",
    about: {
      what: "A full-viewport animated liquid shader that dims when you hover or focus designated UI areas, then brightens back in two timed phases.",
      authorThoughts:
        "Dimming when attention moves to foreground controls makes the rest of the UI recede and signals 'you have my attention.' Brightening starts immediately on exit — quick to 65%, then a slow exhale to full rest — evoking that the LLM is awaiting your interaction without feeling rushed.",
      howToUse:
        "Hover, focus, or tap the trigger cards to feel the dim contract. Tune props in the lab panel and copy integration snippets from the docs link.",
    },
    ranking: {
      importance: 9,
      frequency: 7,
      createdAt: "2026-04-20",
      updatedAt: "2026-04-24",
    },
  },
  {
    slug: "gen-ui",
    title: "Gen UI blocks",
    description:
      "Structured Arcadia chat blocks — answer card, decision matrix, plan timeline, audio snippet — with streaming skeletons and fallbacks.",
    about: {
      what: "A fixture gallery for structured chat blocks the model can emit instead of plain markdown — each block type has a schema, renderer, and fallback path.",
      howToUse:
        "Switch tabs to see valid blocks, partial recovery, invalid-to-markdown fallback, and streaming skeleton stages.",
      adminQuestion:
        "What is the core design intent behind gen-UI blocks — when should Arcadia choose structured UI over prose, and what feeling should that create for the user?",
    },
    ranking: {
      importance: 8,
      frequency: 5,
      createdAt: "2026-05-16",
      updatedAt: "2026-05-16",
    },
  },
  {
    slug: "gen-ui-lab",
    title: "Gen UI Lab",
    description:
      "Quick-creation sandbox for all gen-UI archetypes — scroll the gallery, focus one, and use Aion to select or generate content on demand.",
    about: {
      what: "An Aion-driven workshop for every gen-UI archetype — browse fixtures, focus one block, and ask the model to select or generate content for it.",
      howToUse:
        "Pick an archetype from the gallery, describe what you want in the composer, and let Aion call the gen-UI tools to render or update the block.",
      adminQuestion:
        "What workflow were you imagining for Gen UI Lab — is this primarily for design review, archetype authoring, or something else?",
    },
    ranking: {
      importance: 9,
      frequency: 3,
      createdAt: "2026-07-10",
      updatedAt: "2026-07-10",
    },
  },
  {
    slug: "spatial-archetypes",
    title: "Spatial Archetypes",
    description:
      "Spatial library for revisiting gen-ui artifacts — plans gallery, bookshelf guides, audio rack previews. Requires Coalescence Mode.",
    about: {
      what: "A spatial layout library for gen-UI artifacts — plans, bookshelf guides, and audio racks arranged in a revisitable 3D-ish stage rather than inline chat cards.",
      howToUse:
        "Enable Coalescence Mode, then browse artifact zones and interact with the spatial previews.",
      adminQuestion:
        "What problem does the spatial archetype library solve that inline gen-UI blocks do not? What should 'revisiting' an artifact feel like?",
    },
    ranking: {
      importance: 9,
      frequency: 4,
      createdAt: "2026-06-17",
      updatedAt: "2026-06-17",
    },
  },
  {
    slug: "mermaid",
    title: "Mermaid render harness",
    description:
      "Fixtures for the strict-mode, sanitized Mermaid pipeline — flowchart, sequence, state, quoted special-character labels, and graceful error fallback.",
    about: {
      what: "A render test bench for the sanitized Mermaid pipeline used in Arcadia chat — exercises strict mode, special characters, and error fallback.",
      howToUse:
        "Scroll through fixtures to confirm diagrams render correctly; the error fixture should degrade gracefully instead of breaking the page.",
      adminQuestion:
        "Why strict-mode Mermaid specifically — what trust or safety properties were you optimizing for in chat?",
    },
    ranking: {
      importance: 6,
      frequency: 3,
      createdAt: "2026-06-19",
      updatedAt: "2026-06-19",
    },
  },
  {
    slug: "llm-states",
    title: "LLM states",
    description:
      "All chat loading and action states (thinking, reasoning, search, memory, tool, errored) in one place for development.",
    about: {
      what: "A catalog of every in-chat loading and tool-result state — thinking, reasoning, search, memory, tools, and errors — rendered with production components.",
      howToUse:
        "Use the tabs to preview each state in isolation while tuning copy, motion, or layout.",
      adminQuestion:
        "Is there a motion or tone philosophy behind how these states should feel distinct from each other?",
    },
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
      "Three-column lab: shipped glass(), approved Organic Glass baseline, and a working surface column for lighting experiments — tuned for AdaptiveLiquidChrome.",
    about: {
      what: "A three-column comparison lab for the glass() primitive — what ships today, the approved Organic Glass baseline, and a scratch column for lighting experiments.",
      authorThoughts:
        "Glass surfaces are tuned as foreground lenses for AdaptiveLiquidChrome: readable by default, responsive through cheap opacity shifts when the background dims.",
      howToUse:
        "Compare columns side by side under a live liquid chrome background; adjust lighting in the working column without touching production tokens.",
    },
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
    about: {
      what: "Typography comparison on identical Organic Glass v2 columns — Satoshi, Inter, and Commissioner under the same lighting.",
      howToUse:
        "Read each column at the same size and weight steps; toggle theme to see contrast on glass.",
      adminQuestion:
        "What made Commissioner the direction for UI v2 — what qualities were you optimizing for in glass-heavy layouts?",
    },
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
    about: {
      what: "A side-by-side snapshot of core surfaces — current production UI versus the Commissioner + Organic Glass v2 direction.",
      howToUse:
        "Scroll through paired sections to compare spacing, type, and glass treatment surface by surface.",
      adminQuestion:
        "What is the bar for graduating UI v2 from snapshot to production — which surfaces must feel right first?",
    },
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
    about: {
      what: "A structured table prototype — name a wine and get rows for Wine, Style, and Key Food Affinities with edit, reorder, and sort.",
      howToUse:
        "Enter a wine in the composer, then edit rows inline or change sort order to stress-test the table UX.",
      adminQuestion:
        "What real-world list or domain was the wine line list standing in for — what table interaction were you trying to prove out?",
    },
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
      "Ritual surface: capture a thought into memory with GPU particle state as the primary status channel (mobile-first).",
    about: {
      what: "A ritual surface for one-shot 'thought → memory' where GPU particle motion is the primary status channel — full chat chrome is intentionally absent.",
      authorThoughts:
        "Motion is the primary feedback channel, not prose status lines. Each particle state maps to a felt intention — calm presence when idle, inward pull while ingesting, outward reach during web search, a brief crystallize pulse when memory is filed.",
      howToUse:
        "Open a thread, type a thought, and watch particle states track the ingest pipeline. Mobile-first layout; reduced motion falls back to a static indicator.",
    },
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
    about: {
      what: "A five-section editor (raw → refined → elaborated → design instructions → AI instructions) that turns rough thoughts into structured artifacts via layered generation.",
      authorThoughts:
        "Snap-scrolling between section cards, sticky generate controls when Raw/Refined is visible, and per-page local-only (ZDR) mode so sensitive pages never touch the database.",
      howToUse:
        "Create a page from the browser, fill Raw text, then generate downstream sections. Toggle local-only for zero-database-retention on that page.",
    },
    ranking: {
      importance: 9,
      frequency: 6,
      createdAt: "2026-04-22",
      updatedAt: "2026-04-24",
    },
  },
  {
    slug: "ergon",
    title: "Ergon board (kanban puppet)",
    description:
      "LLM-driven kanban chat style: stream INITIATE -> hydrate -> show-view commands into a client store and render saved views with motion.",
    about: {
      what: "A kanban puppet — step through INITIATE → hydrate → show-view commands into a client store and render saved board views with motion, without hitting an API.",
      howToUse: "Use the step buttons to replay fixture commands and switch between saved views.",
      adminQuestion:
        "What is Ergon meant to become in production chat — a full task surface, a lightweight status board, or something else?",
    },
    ranking: {
      importance: 8,
      frequency: 4,
      createdAt: "2026-05-31",
      updatedAt: "2026-05-31",
    },
  },
  {
    slug: "morphs",
    title: "Morph input (physics)",
    description:
      "Spring-driven layout morph between homepage composer and chat core input using @organic-llm/morph-physics.",
    about: {
      what: "Spring-driven layout morphs between homepage composer and chat core input (and chat ↔ rabbit-hole in the chat-archetype sub-route) via @organic-llm/morph-physics.",
      authorThoughts:
        "Layout transitions should feel physically continuous — the same shell element morphs its bounds rather than cross-fading two separate UIs. Shift+Tab toggles archetype on these demo routes.",
      howToUse:
        "On the main morph page, toggle between homepage and chat input layouts. Open chat-archetype for the chat ↔ rabbit-hole shell morph.",
    },
    ranking: {
      importance: 7,
      frequency: 4,
      createdAt: "2026-05-07",
      updatedAt: "2026-05-07",
    },
  },
];

export type PrototypeTierId = "flagship" | "featured" | "library";

const FLAGSHIP_COUNT = 3;
const FEATURED_COUNT = 5;

/** Combined manual signal used to size gallery cards — importance and frequency weigh equally. */
export function getPrototypeProminence(entry: PrototypeEntry): number {
  return (entry.ranking?.importance ?? 0) + (entry.ranking?.frequency ?? 0);
}

/**
 * Gallery tiers, most prominent first. Rank-based rather than threshold-based so the browser
 * layout keeps its shape as rankings evolve: top 3 flagship, next 5 featured, rest library.
 * Ties break on importance, then title, so the layout is deterministic.
 */
export function getPrototypeTiers(): Record<PrototypeTierId, PrototypeEntry[]> {
  const sorted = [...prototypes].sort(
    (a, b) =>
      getPrototypeProminence(b) - getPrototypeProminence(a) ||
      (b.ranking?.importance ?? 0) - (a.ranking?.importance ?? 0) ||
      a.title.localeCompare(b.title)
  );

  return {
    flagship: sorted.slice(0, FLAGSHIP_COUNT),
    featured: sorted.slice(FLAGSHIP_COUNT, FLAGSHIP_COUNT + FEATURED_COUNT),
    library: sorted.slice(FLAGSHIP_COUNT + FEATURED_COUNT),
  };
}

export function getPrototypeHref(slug: string): string {
  return `/sandbox/prototypes/${slug}`;
}

export function getPrototypeBySlug(slug: string): PrototypeEntry | undefined {
  return prototypes.find((p) => p.slug === slug);
}

export function extractPrototypeSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/sandbox\/prototypes\/([^/]+)/);

  return match?.[1] ?? null;
}
