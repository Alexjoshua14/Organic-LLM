/**
 * Sandbox Gateway registry — single source of truth for `/sandbox` cards.
 * Descriptions are written for someone opening the gateway with no insider context.
 */

export type SandboxEntrySize = "small" | "large";

export type SandboxEntry = {
  title: string;
  /** Plain-language explanation of what you get when you open this destination. */
  description: string;
  href: string;
  size: SandboxEntrySize;
  /** Optional badge for experimental or admin-adjacent areas. */
  badge?: "experimental" | "admin-tools";
};

export const sandboxGatewayEntries: SandboxEntry[] = [
  {
    title: "Arcadia",
    description:
      "Full chat sandbox — same core chat stack as production, but isolated for trying prompts, tools, gen-UI blocks, and UI variants without affecting your main threads.",
    href: "/sandbox/arcadia",
    size: "large",
  },
  {
    title: "Noesis",
    description:
      "Exploration chat for following a topic: memory-aware sparks, steerable assist for your next line, and read-only memory (nothing is written to Mem0 from this mode).",
    href: "/sandbox/topic-explore",
    size: "large",
  },
  {
    title: "Aion",
    description:
      "L0 intelligence layer — the archetype-aware assistant shell with tool access, used to prototype how Organic LLM reasons before features graduate upstream.",
    href: "/sandbox/aion",
    size: "large",
    badge: "experimental",
  },
  {
    title: "Ideas",
    description:
      "Lightweight idea inbox: capture thoughts, set priority, and track status while features are still forming.",
    href: "/sandbox/ideas",
    size: "small",
  },
  {
    title: "Prototypes",
    description:
      "Gallery of standalone UI slices — backgrounds, glass, gen-UI blocks, motion, memory rituals, and more. Each entry explains what it is before you open it.",
    href: "/sandbox/prototypes",
    size: "large",
  },
  {
    title: "Tasks",
    description:
      "Task board sandbox with client and server paths — create, edit, and exercise task flows end to end.",
    href: "/sandbox/tasks",
    size: "large",
  },
  {
    title: "Quick Tasks",
    description:
      "Minimal server-only task creation — a thin path for testing persistence without the full task UI.",
    href: "/sandbox/tasks/server",
    size: "small",
  },
  {
    title: "Text-to-Speech",
    description:
      "Generate responses tuned for spoken playback — shorter sentences, clearer pacing, and audio-friendly structure.",
    href: "/sandbox/tts",
    size: "large",
  },
  {
    title: "Prometheus",
    description:
      "Early AI interface shell with organic layout and a 3D visualization placeholder — a staging area for future presence work.",
    href: "/sandbox/prometheus",
    size: "large",
    badge: "experimental",
  },
  {
    title: "Memory",
    description:
      "Preview memory UI in isolation — lens cards, persisted memory rows, and ephemeral in-chat previews with sample data.",
    href: "/sandbox/memory",
    size: "small",
  },
  {
    title: "Memory migration tests",
    description:
      "Side-by-side retrieval comparison between legacy `memories` and `memories_v2` using batched sandbox queries.",
    href: "/sandbox/migration-tests",
    size: "small",
    badge: "admin-tools",
  },
  {
    title: "Sandbox Platform",
    description:
      "Pipeline debugger — run real Rabbit Hole scenarios, inspect traces, and test LLM-backed functions against production components.",
    href: "/sandbox/platform",
    size: "large",
  },
  {
    title: "Spark",
    description:
      "Alternate chat shell for spark-style threads — same chat data layer as Arcadia with a different presentation route.",
    href: "/sandbox/spark",
    size: "small",
    badge: "experimental",
  },
  {
    title: "Morph chat",
    description:
      "Experimental chat shell for layout-morph work — pairs with the Morph prototypes under Prototypes.",
    href: "/sandbox/morphChat",
    size: "small",
    badge: "experimental",
  },
];
