/**
 * Mermaid sources shared by the sandbox labs (`/sandbox/prototypes/mermaid` and the Gen UI Lab's
 * Diagram page). Lab data only: nothing here is a schema or a tool contract.
 */

/** A 7-node gist of the chat request path. Shares node IDs with `MERMAID_DENSE_DETAILED`. */
export const MERMAID_DENSE_OVERVIEW = [
  "flowchart TD",
  '  A["Client"] --> B["API Gateway"]',
  '  B --> C["Auth"]',
  '  B --> D["Chat Service"]',
  '  D --> E["LLM Router"]',
  '  E --> F["Model A"]',
  '  E --> G["Model B"]',
].join("\n");

/** The full 14-node chat request path. */
export const MERMAID_DENSE_DETAILED = [
  "flowchart TD",
  '  A["Client"] --> B["API Gateway"]',
  '  B --> C["Auth"]',
  '  B --> D["Chat Service"]',
  '  C --> C1["JWT verify"]',
  '  C --> C2["Session store"]',
  '  D --> D1["Message pack"]',
  '  D --> D2["Tool runner"]',
  '  D --> E["LLM Router"]',
  '  E --> F["Model A"]',
  '  E --> G["Model B"]',
  '  D2 --> H["Mermaid gen"]',
  '  D2 --> I["Web search"]',
  '  H --> J["Validate + repair"]',
].join("\n");

/** Four nodes with quoted edge labels: a glance-sized aside. */
export const MERMAID_FLOWCHART_EDGE_LABELS = [
  "flowchart TD",
  '  Start["Receive request"] --> Validate["Validate input"]',
  '  Validate -->|"ok"| Process["Process order"]',
  '  Validate -->|"invalid"| Reject["Return 400"]',
].join("\n");

export const MERMAID_SEQUENCE = [
  "sequenceDiagram",
  "  participant User",
  "  participant API",
  "  User->>API: Submit form",
  "  API-->>User: 200 OK",
].join("\n");

export const MERMAID_SUBGRAPH = [
  "flowchart LR",
  '  subgraph Core["Aetherion Core AI"]',
  '    Mem["Memory"] --> Cog["Cognition"]',
  "  end",
  '  Core --> UI["Arcadia: UI & Knowledge"]',
].join("\n");

export const MERMAID_INVALID = ["flowchart TD", "  My Node --> Other (oops)"].join("\n");

/**
 * The overview graph with long, wrapping labels and edge labels. Node IDs match
 * `MERMAID_DENSE_OVERVIEW`, so it stays a valid dual-source pair with the detailed graph.
 */
export const MERMAID_LONG_LABELS_OVERVIEW = [
  "flowchart TD",
  '  A["Client application in the browser or the installed app"] -->|"signed request with session token"| B["API gateway with rate limiting and request tracing"]',
  '  B -->|"verify identity"| C["Authentication and session verification service"]',
  '  B -->|"forward message"| D["Chat orchestration service with streaming responses"]',
  '  D -->|"pick a model for the request"| E["Model router weighing cost, latency and capability"]',
  '  E --> F["Primary reasoning model for long answers"]',
  '  E --> G["Fast fallback model for short replies"]',
].join("\n");

/** `make_mermaid_diagram` dual-source output: overview inline, detailed on expand. */
export const MERMAID_DUAL_SOURCE_OUTPUT = {
  success: true,
  density: "detailed",
  title: "Chat request path",
  overviewCode: MERMAID_DENSE_OVERVIEW,
  detailedCode: MERMAID_DENSE_DETAILED,
  code: MERMAID_DENSE_OVERVIEW,
} as const satisfies Record<string, unknown>;
