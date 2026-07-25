import type { GenUIBlock } from "./index";

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
        { name: "fresh blueberries", quantity: "1", unit: "cup", status: "need", recipe: "Lemon bars" },
        { name: "lemons", quantity: "3", status: "have", checked: true },
        { name: "mixed greens", quantity: "1", unit: "bag", status: "need" },
      ],
    },
    {
      category: "Dairy",
      items: [
        { name: "unsalted butter", quantity: "1", unit: "cup", status: "need", recipe: "Lemon bars" },
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

function popularTimesBars(eveningPeak: number): { hour: number; occupancy: number }[] {
  return Array.from({ length: 15 }, (_, i) => {
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

export const ALL_VALID_FIXTURES: GenUIBlock[] = [
  FIXTURE_ANSWER_CARD,
  FIXTURE_DECISION_MATRIX,
  FIXTURE_PLAN_TIMELINE,
  FIXTURE_AUDIO_SNIPPET,
  FIXTURE_RECIPE_CARD,
  FIXTURE_SHOPPING_LIST,
  FIXTURE_RESTAURANT_CARD,
];
