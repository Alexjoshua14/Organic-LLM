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

export const ALL_VALID_FIXTURES: GenUIBlock[] = [
  FIXTURE_ANSWER_CARD,
  FIXTURE_DECISION_MATRIX,
  FIXTURE_PLAN_TIMELINE,
  FIXTURE_AUDIO_SNIPPET,
];
