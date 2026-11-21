/**
 * Mermaid sources shared by the sandbox labs (`/sandbox/prototypes/mermaid` and the Gen UI Lab's
 * Diagram page). Lab data only: nothing here is a schema or a tool contract.
 *
 * Showcase graphs are Organic-flavoured so the Gen UI Lab Diagram page reads as a product tour,
 * not a generic API flowchart.
 */

// ── Showcase: glance flowchart (≤5 nodes) ─────────────────────────────────

/** Remy routes a dinner ask — glance density with edge labels. */
export const MERMAID_GLANCE_REMY = [
  "flowchart TD",
  '  Ask["What is for dinner?"] -->|"profile known"| Remy["Remy"]',
  '  Ask -->|"cold start"| Prefs["Ask preferences"]',
  '  Remy --> Recipe["Recipe card"]',
  '  Prefs --> Remy',
].join("\n");

// ── Showcase: sequence ────────────────────────────────────────────────────

/** Speak realtime turn — voice in, tools optional, audio out. */
export const MERMAID_SEQUENCE_SPEAK = [
  "sequenceDiagram",
  "  participant You",
  "  participant Speak",
  "  participant Realtime",
  "  participant Ergon",
  "  You->>Speak: voice turn",
  "  Speak->>Realtime: stream tokens",
  "  Realtime-->>Speak: audio chunks",
  "  Speak->>Ergon: optional board tool",
  "  Ergon-->>Speak: ticket snapshot",
  "  Speak-->>You: spoken reply",
].join("\n");

/** Compact sequence kept for the standalone Mermaid prototype page. */
export const MERMAID_SEQUENCE = MERMAID_SEQUENCE_SPEAK;

// ── Showcase: state diagram ───────────────────────────────────────────────

/** Ergon ticket lifecycle — stateDiagram-v2. */
export const MERMAID_STATE_ERGON = [
  "stateDiagram-v2",
  "  [*] --> Backlog",
  "  Backlog --> Ready: groom",
  "  Ready --> Active: start",
  "  Active --> Review: open PR",
  "  Review --> Active: changes requested",
  "  Review --> Done: merge",
  "  Done --> [*]",
].join("\n");

// ── Showcase: ER (Living Profile) ─────────────────────────────────────────

/** Living Profile shape — domains, nodes, dependency edges. */
export const MERMAID_ER_PROFILE = [
  "erDiagram",
  "  PROFILE ||--o{ DOMAIN : groups",
  "  DOMAIN ||--o{ NODE : holds",
  "  NODE }o--o{ NODE : depends_on",
  "  NODE ||--o{ EVIDENCE : cites",
  "  PROFILE {",
  "    string profileId",
  "    string title",
  "  }",
  "  DOMAIN {",
  "    string id",
  "    string label",
  "    string tone",
  "  }",
  "  NODE {",
  "    string id",
  "    string kind",
  "    string status",
  "    float confidence",
  "  }",
  "  EVIDENCE {",
  "    string source",
  "    string quote",
  "  }",
].join("\n");

// ── Showcase: dual-source Arcadia / Organic stack ─────────────────────────

/**
 * Overview gist of an Arcadia turn. Node IDs are a subset of
 * `MERMAID_ARCADIA_DETAILED` so expand stays a valid dual-source pair.
 */
export const MERMAID_ARCADIA_OVERVIEW = [
  "flowchart TD",
  '  You["You"] --> Arcadia["Arcadia"]',
  '  Arcadia --> LLM["LLM"]',
  '  Arcadia --> Tools["Tools"]',
  '  Tools --> Mem0["Mem0"]',
  '  Tools --> GenUI["Gen UI"]',
  '  Tools --> Mermaid["Mermaid"]',
  '  GenUI --> Thread["In-thread UI"]',
].join("\n");

/** Full Arcadia turn — 14 nodes; expand target for density detailed. */
export const MERMAID_ARCADIA_DETAILED = [
  "flowchart TD",
  '  You["You"] --> CoreInput["CoreInput"]',
  '  CoreInput --> Arcadia["Arcadia"]',
  '  Arcadia --> Auth["Auth + thread"]',
  '  Arcadia --> LLM["LLM"]',
  '  Arcadia --> Tools["Tools"]',
  '  Tools --> Mem0["Mem0"]',
  '  Tools --> Web["Web search"]',
  '  Tools --> GenUI["Gen UI"]',
  '  Tools --> Mermaid["Mermaid"]',
  '  Tools --> Ergon["Ergon board"]',
  '  GenUI --> Measure["measure"]',
  '  GenUI --> ProfileMap["profile-map"]',
  '  Mermaid --> Validate["Validate + repair"]',
  '  GenUI --> Thread["In-thread UI"]',
  '  Mermaid --> Thread',
  '  Ergon --> Thread',
].join("\n");

/** Legacy aliases — older lab / tests that still name the chat-request path. */
export const MERMAID_DENSE_OVERVIEW = MERMAID_ARCADIA_OVERVIEW;
export const MERMAID_DENSE_DETAILED = MERMAID_ARCADIA_DETAILED;

/**
 * Overview with long wrapping labels. Shares node IDs with `MERMAID_ARCADIA_OVERVIEW`
 * so it remains a valid pair against the detailed graph.
 */
export const MERMAID_LONG_LABELS_OVERVIEW = [
  "flowchart TD",
  '  You["Person at the keyboard, mid-thought"] -->|"typed or steered turn"| Arcadia["Arcadia chat surface with tools and gen-UI"]',
  '  Arcadia -->|"route the request"| LLM["Model chosen for cost, latency, and depth"]',
  '  Arcadia -->|"invoke when structure helps"| Tools["Toolbelt: memory, search, diagrams, blocks"]',
  '  Tools -->|"read and write living memory"| Mem0["Mem0 keyed to the profile id"]',
  '  Tools -->|"typed blocks in the thread"| GenUI["Generative UI registry and renderer"]',
  '  Tools -->|"validated Mermaid source"| Mermaid["make_mermaid_diagram with repair loop"]',
  '  GenUI -->|"answer-card, measure, profile-map, …"| Thread["Structured UI beside the prose"]',
].join("\n");

/** Subgraph grouping — Organic studio stack. */
export const MERMAID_SUBGRAPH = [
  "flowchart LR",
  '  subgraph Studio["Coalescence Labs"]',
  '    Organic["Organic LLM"] --> ArcadiaNode["Arcadia"]',
  '    Organic --> SpeakNode["Speak"]',
  '    Organic --> StageNode["Stage"]',
  "  end",
  '  ArcadiaNode --> GenUINode["Gen UI blocks"]',
  '  SpeakNode --> Voice["Realtime voice"]',
  '  StageNode --> Canvas["Spatial canvas"]',
].join("\n");

/** Four-node glance with edge labels (standalone Mermaid page + legacy glance). */
export const MERMAID_FLOWCHART_EDGE_LABELS = MERMAID_GLANCE_REMY;

export const MERMAID_INVALID = ["flowchart TD", "  My Node --> Other (oops)"].join("\n");

/** `make_mermaid_diagram` dual-source output: overview inline, detailed on expand. */
export const MERMAID_DUAL_SOURCE_OUTPUT = {
  success: true,
  density: "detailed",
  title: "Arcadia turn anatomy",
  overviewCode: MERMAID_ARCADIA_OVERVIEW,
  detailedCode: MERMAID_ARCADIA_DETAILED,
  code: MERMAID_ARCADIA_OVERVIEW,
} as const satisfies Record<string, unknown>;

/** Glance tool payload — Remy dinner route. */
export const MERMAID_GLANCE_OUTPUT = {
  success: true,
  density: "glance",
  title: "Remy dinner route",
  overviewCode: MERMAID_GLANCE_REMY,
  detailedCode: MERMAID_GLANCE_REMY,
  code: MERMAID_GLANCE_REMY,
} as const satisfies Record<string, unknown>;

/** Sequence tool payload — Speak turn. */
export const MERMAID_SEQUENCE_OUTPUT = {
  success: true,
  density: "overview",
  title: "Speak realtime turn",
  overviewCode: MERMAID_SEQUENCE_SPEAK,
  detailedCode: MERMAID_SEQUENCE_SPEAK,
  code: MERMAID_SEQUENCE_SPEAK,
} as const satisfies Record<string, unknown>;

/** State tool payload — Ergon lifecycle. */
export const MERMAID_STATE_OUTPUT = {
  success: true,
  density: "overview",
  title: "Ergon ticket lifecycle",
  overviewCode: MERMAID_STATE_ERGON,
  detailedCode: MERMAID_STATE_ERGON,
  code: MERMAID_STATE_ERGON,
} as const satisfies Record<string, unknown>;

/** ER tool payload — Living Profile. */
export const MERMAID_ER_OUTPUT = {
  success: true,
  density: "overview",
  title: "Living Profile schema",
  overviewCode: MERMAID_ER_PROFILE,
  detailedCode: MERMAID_ER_PROFILE,
  code: MERMAID_ER_PROFILE,
} as const satisfies Record<string, unknown>;

/** Overview dual-source — Arcadia tools gist with detailed expand. */
export const MERMAID_OVERVIEW_OUTPUT = {
  success: true,
  density: "overview",
  title: "Arcadia tool path",
  overviewCode: MERMAID_ARCADIA_OVERVIEW,
  detailedCode: MERMAID_ARCADIA_DETAILED,
  code: MERMAID_ARCADIA_OVERVIEW,
} as const satisfies Record<string, unknown>;

/** Long-label stress — wrapping node and edge copy. */
export const MERMAID_LONG_LABELS_OUTPUT = {
  success: true,
  density: "overview",
  title: "Arcadia path, annotated",
  overviewCode: MERMAID_LONG_LABELS_OVERVIEW,
  detailedCode: MERMAID_ARCADIA_DETAILED,
  code: MERMAID_LONG_LABELS_OVERVIEW,
} as const satisfies Record<string, unknown>;
