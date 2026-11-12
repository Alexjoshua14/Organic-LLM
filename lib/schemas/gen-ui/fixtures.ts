import type { CodeDiffBlock, GenUIBlock } from "./index";

export const FIXTURE_ANSWER_CARD: GenUIBlock = {
  type: "answer-card",
  version: 1,
  title: "Stratum migration approach",
  tldr: "Prefer a phased cutover with dual-write for two weeks, then read from the new store only.",
  keyPoints: [
    "Dual-write reduces rollback risk during the first phase.",
    "Validate search parity before dropping the legacy index.",
    "Budget one engineer-week for observability dashboards.",
    "Communicate a maintenance window for the final flip.",
    "Keep feature flags on the read path for 48h after cutover.",
  ],
  sections: [
    {
      heading: "Phase 1 — shadow writes",
      body: "Mirror writes to both stores; compare checksums nightly.",
      defaultOpen: false,
    },
  ],
  footer: {
    confidence: "medium",
    sources: [{ label: "Internal runbook", url: "https://example.com/runbook" }],
    caveats: ["Assumes current traffic stays under 2× baseline."],
  },
};

export const FIXTURE_DECISION_MATRIX: GenUIBlock = {
  type: "decision-matrix",
  version: 1,
  question: "Which database for the new ingest pipeline?",
  options: [
    { id: "pg", name: "Postgres", note: "Team familiarity" },
    { id: "sqlite", name: "SQLite", note: "Edge deploys" },
    { id: "dynamo", name: "DynamoDB", note: "Burst scale" },
  ],
  criteria: [
    { id: "ops", label: "Operational burden", weight: 3 },
    { id: "cost", label: "Cost at scale", weight: 2 },
    { id: "latency", label: "p99 latency", weight: 4 },
  ],
  scores: {
    pg: {
      ops: { value: 4, note: "Managed RDS" },
      cost: { value: 3 },
      latency: { value: 4 },
    },
    sqlite: {
      ops: { value: 5, note: "Embedded" },
      cost: { value: 5 },
      latency: { value: 3 },
    },
    dynamo: {
      ops: { value: 2 },
      cost: { value: 2, note: "On-demand spikes" },
      latency: { value: 5 },
    },
  },
  recommendation: {
    optionId: "pg",
    rationale: "Best balance of ops maturity and latency for our team size.",
  },
};

export const FIXTURE_PLAN_TIMELINE: GenUIBlock = {
  type: "plan-timeline",
  version: 1,
  title: "Arcadia gen-UI rollout",
  steps: [
    { id: "s1", label: "Schema + registry", status: "done" },
    {
      id: "s2",
      label: "Sandbox gallery",
      status: "now",
      estimate: "1d",
      substeps: [
        { label: "Valid fixtures", done: true },
        { label: "Partial + streaming demos", done: false },
      ],
    },
    {
      id: "s3",
      label: "Arcadia tool wiring",
      status: "next",
      dependsOn: ["s2"],
    },
    { id: "s4", label: "Audio Phase 2", status: "blocked", note: "Awaiting TTS UX sign-off" },
  ],
};

export const FIXTURE_AUDIO_SNIPPET: GenUIBlock = {
  type: "audio-snippet",
  version: 1,
  preview: {
    title: "90s Stratum recap",
    teaser: "Three tradeoffs from today's stratum decisions — migration, search, and cost.",
    duration: "~1:30",
  },
  script:
    "Here's your quick recap. First, we chose phased dual-write for migration safety. Second, search parity gates the cutover. Third, observability gets a dedicated engineer-week before flip.",
  meta: { tone: "concise", voice: "default" },
};

/** Malformed matrix cell note triggers z.catch — block still parses. */
export const FIXTURE_DECISION_MATRIX_PARTIAL: GenUIBlock = {
  ...FIXTURE_DECISION_MATRIX,
  scores: {
    ...FIXTURE_DECISION_MATRIX.scores,
    pg: {
      ...FIXTURE_DECISION_MATRIX.scores.pg,
      ops: { value: 4, note: 12345 as unknown as string },
    },
  },
};

export const FIXTURE_INVALID_BLOCK = {
  type: "answer-card",
  version: 99,
  title: "Bad version",
} as unknown;

export const FIXTURE_STREAMING_STAGES: Record<string, unknown>[] = [
  { type: "answer-card", version: 1 },
  { type: "answer-card", version: 1, title: "Loading title…" },
  {
    type: "answer-card",
    version: 1,
    title: "Streaming example",
    tldr: "Partial stream in progress.",
    keyPoints: ["First point arrived"],
  },
];

export const FIXTURE_RECIPE_CARD: GenUIBlock = {
  type: "recipe-card",
  version: 1,
  title: "Lemon blueberry poppyseed bars",
  servings: "12 bars",
  prepTime: "20 min",
  cookTime: "35 min",
  ingredients: [
    { name: "all-purpose flour", quantity: "2", unit: "cups" },
    { name: "poppy seeds", quantity: "2", unit: "tbsp" },
    { name: "fresh blueberries", quantity: "1", unit: "cup" },
    { name: "lemon zest", quantity: "1", unit: "tbsp" },
    { name: "unsalted butter", quantity: "1", unit: "cup", note: "softened" },
    { name: "granulated sugar", quantity: "1", unit: "cup" },
    { name: "large eggs", quantity: "3" },
    { name: "lemon juice", quantity: "2", unit: "tbsp" },
  ],
  steps: [
    "Heat oven to 350°F. Line a 9×13 pan with parchment.",
    "Whisk flour, poppy seeds, and salt. Fold in blueberries and lemon zest.",
    "Cream butter and sugar until light; beat in eggs and lemon juice.",
    "Fold dry mix into wet until just combined. Spread evenly in the pan.",
    "Bake 30–35 minutes until edges pull away and center is set. Cool before slicing.",
  ],
  notes: "Dust with powdered sugar for serving. Keeps 3 days covered at room temp.",
};

export const FIXTURE_SHOPPING_LIST: GenUIBlock = {
  type: "shopping-list",
  version: 1,
  title: "Saturday dinner prep",
  groups: [
    {
      category: "Produce",
      items: [
        {
          name: "fresh blueberries",
          quantity: "1",
          unit: "cup",
          status: "need",
          recipe: "Lemon bars",
        },
        { name: "lemons", quantity: "3", status: "have", checked: true },
        { name: "mixed greens", quantity: "1", unit: "bag", status: "need" },
      ],
    },
    {
      category: "Dairy",
      items: [
        {
          name: "unsalted butter",
          quantity: "1",
          unit: "cup",
          status: "need",
          recipe: "Lemon bars",
        },
        { name: "large eggs", quantity: "6", status: "have" },
        { name: "parmesan", quantity: "1", unit: "wedge", status: "need" },
      ],
    },
    {
      category: "Pantry",
      items: [
        { name: "poppy seeds", quantity: "2", unit: "tbsp", status: "need", recipe: "Lemon bars" },
        { name: "all-purpose flour", quantity: "2", unit: "cups", status: "have", checked: true },
        { name: "granulated sugar", quantity: "1", unit: "cup", status: "need" },
      ],
    },
  ],
};

/** Hours 11–23: the schema caps `hour` at 23, so the late bars stop at 11pm. */
function popularTimesBars(eveningPeak: number): { hour: number; occupancy: number }[] {
  return Array.from({ length: 13 }, (_, i) => {
    const hour = i + 11;
    const distance = Math.abs(hour - eveningPeak);

    return {
      hour,
      occupancy: Math.max(8, Math.min(100, eveningPeak * 10 - distance * 12 + (hour % 2) * 5)),
    };
  });
}

export const FIXTURE_RESTAURANT_CARD: GenUIBlock = {
  type: "restaurant-card",
  version: 1,
  name: "State Bird Provisions",
  storeType: "fine_dining",
  summary:
    "James Beard Award–winning Californian small-plates restaurant with dim sum–style cart service, known for the signature quail, pancakes, and seasonal vegetable dishes.",
  address: "1529 Fillmore St, San Francisco, CA 94115",
  phone: "(415) 795-0230",
  rating: {
    average: 4.5,
    reviewCount: 3842,
    sources: [
      { name: "yelp", rating: 4.5, reviewCount: 2104 },
      { name: "google", rating: 4.6, reviewCount: 1520 },
      { name: "beli", rating: 4.4, reviewCount: 218 },
    ],
  },
  heroImage: {
    url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    alt: "State Bird Provisions dining room exterior on Fillmore Street",
    kind: "exterior",
  },
  gallery: [
    {
      url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80",
      alt: "Warm interior with open kitchen energy",
      kind: "interior",
    },
    {
      url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
      alt: "Plated seasonal small plates",
      kind: "food",
    },
    {
      url: "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=800&q=80",
      alt: "Busy evening service vibe",
      kind: "vibe",
    },
    {
      url: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80",
      alt: "Neighborhood storefront at dusk",
      kind: "exterior",
    },
  ],
  hours: {
    timezone: "America/Los_Angeles",
    regular: [
      { day: "monday", closed: true },
      { day: "tuesday", open: "5:30 PM", close: "10:00 PM" },
      { day: "wednesday", open: "5:30 PM", close: "10:00 PM" },
      { day: "thursday", open: "5:30 PM", close: "10:00 PM" },
      { day: "friday", open: "5:30 PM", close: "11:00 PM" },
      { day: "saturday", open: "5:00 PM", close: "11:00 PM" },
      { day: "sunday", open: "5:00 PM", close: "9:30 PM" },
    ],
    kitchen: [
      { day: "tuesday", open: "5:30 PM", close: "9:30 PM" },
      { day: "wednesday", open: "5:30 PM", close: "9:30 PM" },
      { day: "thursday", open: "5:30 PM", close: "9:30 PM" },
      { day: "friday", open: "5:30 PM", close: "10:00 PM" },
      { day: "saturday", open: "5:00 PM", close: "10:00 PM" },
      { day: "sunday", open: "5:00 PM", close: "9:00 PM" },
    ],
    holidayOverrides: [
      { date: "2026-12-25", label: "Christmas Day", closed: true },
      { date: "2026-11-26", label: "Thanksgiving", closed: true },
    ],
  },
  menu: {
    lastUpdated: "2026-06-01",
    sourceNote: "From restaurant website",
    sections: [
      {
        name: "From the Cart",
        items: [
          {
            name: "State Bird with Provisions",
            description: "Buttermilk fried quail, spiced plum sauce, onions",
            price: "$22",
          },
          {
            name: "Garlic Bread",
            description: "Sourdough, cultured butter, pecorino",
            price: "$14",
          },
          {
            name: "Pancakes",
            description: "Leo’s oatmeal pancake, spiced maple syrup, cultured butter",
            price: "$18",
          },
        ],
      },
      {
        name: "Vegetables & Small Plates",
        items: [
          {
            name: "Rotating Seasonal Vegetable",
            description: "Farm-driven preparation changes nightly",
            price: "MP",
            dietaryTags: ["vegetarian"],
          },
          {
            name: "Caesar Style Chicories",
            description: "Anchovy, parmesan, sourdough crumbs",
            price: "$16",
          },
        ],
      },
      {
        name: "Dessert",
        items: [
          {
            name: "Soft Serve",
            description: "Rotating flavor, seasonal toppings",
            price: "$12",
          },
        ],
      },
    ],
  },
  popularTimes: [
    { day: "friday", bars: popularTimesBars(20) },
    { day: "saturday", bars: popularTimesBars(19) },
    { day: "thursday", bars: popularTimesBars(18) },
  ],
  links: {
    website: "https://statebirdprovisions.com",
    yelp: "https://www.yelp.com/biz/state-bird-provisions-san-francisco",
    googleMaps: "https://maps.google.com/?q=State+Bird+Provisions+1529+Fillmore+St+San+Francisco",
    directions:
      "https://www.google.com/maps/dir/?api=1&destination=State+Bird+Provisions,1529+Fillmore+St,San+Francisco,CA+94115",
  },
};

export const FIXTURE_RESEARCH_REPORT: GenUIBlock = {
  type: "research-report",
  version: 1,
  threadId: "6f1d2c1e-8a4b-4c55-9d3e-2b7a5e0c9f10",
  title: "Dual-write versus shadow reads for the Stratum cutover",
  summary:
    "Sources agree that dual-write shortens rollback, but disagree on how long to run it. One engineering write-up reports drift after three weeks.",
  sources: [
    {
      id: "src-runbook",
      url: "https://example.com/migration-runbook",
      title: "Zero-downtime store migrations",
      provider: "exa",
      fetchedAt: "2026-11-02T18:04:00Z",
      publishedAt: "2026-03-14",
      excerptOnly: false,
      truncated: false,
      capturedChars: 8200,
      pages: [],
      preview: "Dual-write for two weeks, compare checksums nightly, then flip reads.",
      synopsis: "A phased cutover guide: shadow writes, parity checks, then a read flip.",
      takeaways: ["Compare checksums nightly.", "Keep a feature flag on the read path."],
    },
    {
      id: "src-postmortem",
      url: "https://example.com/dual-write-postmortem",
      title: "What dual-write cost us",
      provider: "firecrawl",
      fetchedAt: "2026-11-02T18:05:00Z",
      publishedAt: null,
      excerptOnly: true,
      truncated: true,
      capturedChars: 1400,
      pages: [],
      preview: "After three weeks the stores had drifted on 0.4% of rows.",
      synopsis: "",
      takeaways: [],
    },
  ],
  claims: [
    {
      id: "claim-rollback",
      statement: "Dual-write reduces rollback risk.",
      assessment: "Supported by the runbook; the post-mortem adds a drift caveat.",
      issues: ["search_excerpt_only"],
      evidence: [
        {
          sourceId: "src-runbook",
          title: "Zero-downtime store migrations",
          url: "https://example.com/migration-runbook",
          quote: "Either store can serve reads at any point during the window.",
          quoteTruncated: false,
          relation: "supports",
        },
        {
          sourceId: "src-postmortem",
          title: "What dual-write cost us",
          quote: "After three weeks the stores had drifted on 0.4% of rows.",
          quoteTruncated: false,
          relation: "contradicts",
        },
      ],
    },
  ],
  limitations: ["Only two sources were captured; one is a search excerpt."],
};

// ── Code diff ─────────────────────────────────────────────
// Realistic unified diffs, written the way a model writes them. Several deliberately omit git
// headers or carry wrong hunk counts: the app recomputes both.

const rows = (...lines: string[]) => lines.join("\n");

const RETRY_CLIENT_DIFF = rows(
  "@@ -38,9 +38,16 @@ export async function searchWebWithQuery(",
  "   query: string,",
  "   options: SearchOptions = {}",
  " ): Promise<WebResult[]> {",
  "   const client = getExaClient();",
  "-  const maxAttempts = 1;",
  "+  const maxAttempts = 3;",
  " ",
  "-  const response = await client.searchAndContents(query, options);",
  "-  return mapResults(response);",
  "+  for (let attempt = 1; ; attempt += 1) {",
  "+    try {",
  "+      const response = await client.searchAndContents(query, options);",
  "+      return mapResults(response);",
  "+    } catch (error) {",
  "+      if (!isRateLimit(error) || attempt >= maxAttempts) throw error;",
  "+      await sleep(backoffMs(attempt));",
  "+    }",
  "+  }",
  " }"
);

const RETRY_HELPERS_DIFF = rows(
  "@@ -0,0 +1,16 @@",
  "+const BASE_MS = 250;",
  "+const MAX_MS = 4_000;",
  "+",
  "+export function sleep(ms: number): Promise<void> {",
  "+  return new Promise((resolve) => setTimeout(resolve, ms));",
  "+}",
  "+",
  "+/** Exponential backoff with full jitter, capped. */",
  "+export function backoffMs(attempt: number): number {",
  "+  const ceiling = Math.min(MAX_MS, BASE_MS * 2 ** (attempt - 1));",
  "+  return Math.floor(Math.random() * ceiling);",
  "+}",
  "+",
  "+export function isRateLimit(error: unknown): boolean {",
  '+  return typeof error === "object" && error !== null && (error as { status?: number }).status === 429;',
  "+}"
);

/** The default showcase: a small, readable multi-file change with one comment. */
export const FIXTURE_CODE_DIFF: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Retry web search on rate limits",
  summary:
    "Exa answers 429 under load. The search client now retries up to three times with jittered backoff instead of failing the whole turn.",
  files: [
    {
      path: "lib/exa/client.ts",
      note: "Wraps the request in a bounded retry loop.",
      diff: RETRY_CLIENT_DIFF,
      annotations: [
        {
          match: "isRateLimit(error)",
          kind: "suggestion",
          text: "Only 429 is retried. Exa also returns 503 during incidents; confirm those should still fail fast.",
        },
      ],
    },
    {
      path: "lib/exa/retry.ts",
      note: "New helpers: sleep, capped full-jitter backoff, and a 429 check.",
      diff: RETRY_HELPERS_DIFF,
    },
    {
      path: ".env.example",
      note: "Documents the new attempt limit.",
      diff: rows(
        "@@ -11,3 +11,4 @@",
        " # Web search",
        " EXA_API_KEY=",
        "+EXA_MAX_ATTEMPTS=3",
        " EXA_TIMEOUT_MS=8000"
      ),
    },
  ],
};

/** One file, one small fix, no git headers, no summary — the commonest chat case. */
export const FIXTURE_CODE_DIFF_SINGLE_FIX: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Ignore memories with an unreadable timestamp",
  files: [
    {
      path: "lib/memory/recency.ts",
      diff: rows(
        "@@ -22,8 +22,8 @@ export function filterMemoriesSince(",
        "   const cutoff = Date.now() - windowMs;",
        " ",
        "   return memories.filter((memory) => {",
        "     const updated = Date.parse(memory.updated_at ?? memory.created_at);",
        "-    return updated > cutoff;",
        "+    return Number.isFinite(updated) && updated >= cutoff;",
        "   });",
        " }"
      ),
    },
  ],
};

/** A rename with edits, a rename with none, a deletion and an importer, using full git headers. */
export const FIXTURE_CODE_DIFF_REFACTOR: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Rename recent-memories to recency",
  summary: "The module now covers more than “recent”, so it takes the shorter name everywhere.",
  files: [
    {
      path: "lib/memory/recency.ts",
      oldPath: "lib/memory/recent-memories.ts",
      diff: rows(
        "diff --git a/lib/memory/recent-memories.ts b/lib/memory/recency.ts",
        "similarity index 94%",
        "rename from lib/memory/recent-memories.ts",
        "rename to lib/memory/recency.ts",
        "index 3f2a9c1..8d41b7e 100644",
        "--- a/lib/memory/recent-memories.ts",
        "+++ b/lib/memory/recency.ts",
        "@@ -1,5 +1,5 @@",
        "-export const RECENT_WINDOW_MS = { hour: 3_600_000, day: 86_400_000 };",
        "+export const RECENCY_WINDOW_MS = { hour: 3_600_000, day: 86_400_000 } as const;",
        " ",
        "-export type RecentWindow = keyof typeof RECENT_WINDOW_MS;",
        "+export type RecentWindow = keyof typeof RECENCY_WINDOW_MS;",
        " ",
        " export function windowMs(window: RecentWindow): number {"
      ),
    },
    {
      path: "docs/recency.md",
      oldPath: "docs/recent.md",
      note: "Moved only; the content is identical.",
      diff: rows(
        "diff --git a/docs/recent.md b/docs/recency.md",
        "similarity index 100%",
        "rename from docs/recent.md",
        "rename to docs/recency.md"
      ),
    },
    {
      path: "lib/memory/legacy-recent.ts",
      note: "Removed: nothing imports the alias any more.",
      diff: rows(
        "diff --git a/lib/memory/legacy-recent.ts b/lib/memory/legacy-recent.ts",
        "deleted file mode 100644",
        "index 9b2c4d0..0000000",
        "--- a/lib/memory/legacy-recent.ts",
        "+++ /dev/null",
        "@@ -1,4 +0,0 @@",
        "-// Superseded by recency.ts; kept for one release.",
        '-export { RECENT_WINDOW_MS as LEGACY_RECENT_WINDOW_MS } from "./recent-memories";',
        "-",
        '-export const LEGACY_DEFAULT_WINDOW = "day";'
      ),
    },
    {
      path: "lib/llm/llm-tool-kit.ts",
      diff: rows(
        "@@ -18,7 +18,7 @@",
        ' import { createLogger } from "@/lib/logger";',
        ' import { getMemoriesForUser } from "@/lib/memory/operations";',
        '-import { filterMemoriesSince } from "@/lib/memory/recent-memories";',
        '+import { filterMemoriesSince } from "@/lib/memory/recency";',
        ' import { searchMemories } from "@/lib/memory/search";'
      ),
    },
  ],
};

/** Config and environment: a value change, a mode change, and a secret written as *** . */
export const FIXTURE_CODE_DIFF_CONFIG: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Return five search results instead of three",
  summary: "Secret values are masked; only the keys and the changed numbers are shown.",
  files: [
    {
      path: ".env.example",
      diff: rows(
        "@@ -8,7 +8,7 @@ # Search",
        " EXA_API_KEY=***",
        "-EXA_RESULTS=3",
        "+EXA_RESULTS=5",
        " EXA_TIMEOUT_MS=8000"
      ),
    },
    {
      path: "scripts/deploy.sh",
      note: "Made executable.",
      diff: rows(
        "diff --git a/scripts/deploy.sh b/scripts/deploy.sh",
        "old mode 100644",
        "new mode 100755"
      ),
    },
  ],
};

/** Review comments: by text, by new-file line, by old-file line, one for the file, one off the diff. */
export const FIXTURE_CODE_DIFF_REVIEW: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Review: retry loop in the search client",
  summary: "Two things to change before merging; the rest reads fine.",
  files: [
    {
      path: "lib/exa/client.ts",
      diff: RETRY_CLIENT_DIFF,
      annotations: [
        {
          match: "throw error",
          kind: "issue",
          text: "This rethrows the raw SDK error. Callers expect a WebSearchError, so wrap it.",
        },
        { line: 42, kind: "note", text: "Default raised from 1 to 3 attempts." },
        { line: 42, side: "old", kind: "note", text: "The old default never retried." },
        {
          line: 900,
          kind: "suggestion",
          text: "This points past the end of the diff, so it is listed under the file instead.",
        },
        { kind: "suggestion", text: "Add a test that returns 429 twice and then succeeds." },
      ],
    },
  ],
};

const CONFIG_KEYS = Array.from(
  { length: 30 },
  (_, i) => `  "tier${i + 1}": { "burst": ${(i + 1) * 5} },`
);

/** Large and awkward: a long unchanged run (folded), a lockfile, a binary file, more files left out. */
export const FIXTURE_CODE_DIFF_LARGE: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Raise the free-tier rate limit",
  summary:
    "Only the first entry changes; the rest of the table is context. Generated files are summarised, not shown.",
  moreFiles: 31,
  files: [
    {
      path: "lib/limits/tiers.json",
      diff: rows(
        "@@ -1,38 +1,38 @@",
        " {",
        '-  "free": { "burst": 10 },',
        '+  "free": { "burst": 25 },',
        ...CONFIG_KEYS.slice(0, 29).map((key) => ` ${key}`),
        '   "last": { "burst": 150 }',
        " }"
      ),
    },
    {
      path: "bun.lock",
      note: "Regenerated by the dependency bump.",
      added: 1204,
      removed: 980,
    },
    {
      path: "public/og.png",
      diff: "Binary files a/public/og.png and b/public/og.png differ",
    },
  ],
};

/** A whole `git diff` pasted into one entry, and a diff with bad counts and no final newline marker. */
export const FIXTURE_CODE_DIFF_PASTED: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Tighten the search timeout",
  files: [
    {
      path: "lib/exa/client.ts",
      diff: rows(
        "diff --git a/lib/exa/client.ts b/lib/exa/client.ts",
        "index 1a2b3c4..5d6e7f8 100644",
        "--- a/lib/exa/client.ts",
        "+++ b/lib/exa/client.ts",
        "@@ -5,3 +5,3 @@",
        " const DEFAULTS = {",
        "-  timeoutMs: 15000,",
        "+  timeoutMs: 8000,",
        " };",
        "diff --git a/lib/exa/types.ts b/lib/exa/types.ts",
        "index 9a8b7c6..0f1e2d3 100644",
        "--- a/lib/exa/types.ts",
        "+++ b/lib/exa/types.ts",
        "@@ -1,2 +1,2 @@",
        "-export type SearchOptions = { timeoutMs?: number };",
        "\\ No newline at end of file",
        "+export type SearchOptions = { timeoutMs?: number; maxAttempts?: number };",
        "\\ No newline at end of file"
      ),
    },
  ],
};

/** Output that is not a diff must degrade to text, never crash. */
export const FIXTURE_CODE_DIFF_MALFORMED: CodeDiffBlock = {
  type: "code-diff",
  version: 1,
  title: "Imperfect model output",
  files: [
    { path: "notes.txt", diff: "I changed the retry logic to use exponential backoff." },
    {
      path: "src/truncated.ts",
      diff: rows("@@ -1,2 +1,99 @@", " const a = 1;", "-const b = 2;", "+const b = 3"),
    },
  ],
};

/** Every code-diff fixture; only `FIXTURE_CODE_DIFF` is in ALL_VALID_FIXTURES (one per type). */
export const CODE_DIFF_FIXTURES: CodeDiffBlock[] = [
  FIXTURE_CODE_DIFF,
  FIXTURE_CODE_DIFF_SINGLE_FIX,
  FIXTURE_CODE_DIFF_REFACTOR,
  FIXTURE_CODE_DIFF_CONFIG,
  FIXTURE_CODE_DIFF_REVIEW,
  FIXTURE_CODE_DIFF_LARGE,
  FIXTURE_CODE_DIFF_PASTED,
  FIXTURE_CODE_DIFF_MALFORMED,
];

export const ALL_VALID_FIXTURES: GenUIBlock[] = [
  FIXTURE_ANSWER_CARD,
  FIXTURE_DECISION_MATRIX,
  FIXTURE_PLAN_TIMELINE,
  FIXTURE_AUDIO_SNIPPET,
  FIXTURE_RECIPE_CARD,
  FIXTURE_SHOPPING_LIST,
  FIXTURE_RESTAURANT_CARD,
  FIXTURE_RESEARCH_REPORT,
  FIXTURE_CODE_DIFF,
];
