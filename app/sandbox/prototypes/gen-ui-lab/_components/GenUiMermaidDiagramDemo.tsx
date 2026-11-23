"use client";

import {
  MERMAID_DUAL_SOURCE_OUTPUT,
  MERMAID_ER_OUTPUT,
  MERMAID_GLANCE_OUTPUT,
  MERMAID_LONG_LABELS_OUTPUT,
  MERMAID_OVERVIEW_OUTPUT,
  MERMAID_SEQUENCE_OUTPUT,
  MERMAID_STATE_OUTPUT,
} from "../../_fixtures/mermaid-fixtures";
import {
  useGenUiArrangementCycle,
  type GenUiArrangement,
} from "../_hooks/use-gen-ui-arrangement-cycle";

import { GenUiArrangementPauseZone, GenUiArrangementToolbar } from "./GenUiArrangementToolbar";

import { MermaidToolDiagram } from "@/components/mermaid/mermaid-tool-diagram";

/**
 * The Diagram page is lab-only. Mermaid is a chat tool (`make_mermaid_diagram`), not a Gen UI
 * block, so it joins the gallery as an extra archetype id beside the block types rather than
 * through the Gen UI schema or registry.
 */
export const LAB_DIAGRAM_ARCHETYPE = "mermaid-diagram" as const;
export const LAB_DIAGRAM_LABEL = "Diagram";

type DiagramPreset = GenUiArrangement & {
  /** A `make_mermaid_diagram` tool result, exactly as the chat renderer receives it. */
  output: Record<string, unknown>;
};

/**
 * Showcase states: diagram *types* (flowchart, sequence, state, ER) and density tiers
 * (glance → overview → detailed), plus a long-label stress case — enough to read the full
 * potential of `make_mermaid_diagram` from the lab alone.
 */
export const LAB_DIAGRAM_PRESETS: ReadonlyArray<DiagramPreset> = [
  {
    id: "glance",
    name: "Glance · flowchart",
    intent: "Four nodes as a visual aside — Remy routes a dinner ask. Expand is the same gist.",
    output: { ...MERMAID_GLANCE_OUTPUT },
  },
  {
    id: "sequence",
    name: "Sequence · Speak",
    intent: "Realtime voice turn: you → Speak → Realtime → optional Ergon → spoken reply.",
    output: { ...MERMAID_SEQUENCE_OUTPUT },
  },
  {
    id: "state",
    name: "State · Ergon",
    intent: "Ticket lifecycle as stateDiagram-v2 — backlog through done, with a review loop.",
    output: { ...MERMAID_STATE_OUTPUT },
  },
  {
    id: "er",
    name: "ER · Living Profile",
    intent: "Schema sketch: profile → domains → nodes → evidence, plus depends_on edges.",
    output: { ...MERMAID_ER_OUTPUT },
  },
  {
    id: "overview",
    name: "Overview · Arcadia",
    intent:
      "Answer structure inline. Expand opens the same gist with the full tool neighborhood one step away.",
    output: { ...MERMAID_OVERVIEW_OUTPUT },
  },
  {
    id: "detailed",
    name: "Detailed · Organic stack",
    intent:
      "Reference density. Inline still shows the overview; expand opens the full Arcadia turn graph.",
    output: { ...MERMAID_DUAL_SOURCE_OUTPUT },
  },
  {
    id: "long-labels",
    name: "Long labels",
    intent: "Wrapping node and edge copy — check legibility and width inside the well.",
    output: { ...MERMAID_LONG_LABELS_OUTPUT },
  },
];

/** Each smaller drawing represents the same fixture and keeps its central path. */
const CONDENSED_DIAGRAMS: Record<string, string> = {
  glance: [
    "flowchart TD",
    'Ask["Dinner request"] -->|"preferences known"| Remy',
    'Ask -->|"cold start"| Prefs["Ask preferences"] --> Remy',
    'Remy --> Recipe["Recipe card"]',
  ].join("\n"),
  sequence: [
    "sequenceDiagram",
    "You->>Speak: Voice turn",
    "Speak->>Realtime: Generate audio",
    "opt Board lookup",
    "Speak->>Ergon: Get ticket context",
    "end",
    "Speak-->>You: Spoken reply",
  ].join("\n"),
  state: [
    "stateDiagram-v2",
    "Backlog --> Ready",
    "Ready --> Active",
    "Active --> Review",
    "Review --> Done: merge",
    "Review --> Active: revise",
  ].join("\n"),
  er: [
    "erDiagram",
    "PROFILE ||--o{ DOMAIN : groups",
    "DOMAIN ||--o{ NODE : holds",
    "NODE }o--o{ NODE : depends_on",
    "NODE ||--o{ EVIDENCE : cites",
  ].join("\n"),
  overview: [
    "flowchart TD",
    "You --> Arcadia --> LLM",
    "Arcadia --> Tools",
    'Tools --> GenUI["Gen UI"] --> Thread["In-thread UI"]',
  ].join("\n"),
  detailed: [
    "flowchart TD",
    "You --> Arcadia --> LLM",
    "Arcadia --> Tools",
    'Tools --> GenUI["Gen UI"] --> Thread["In-thread UI"]',
    "Tools --> Mermaid --> Thread",
  ].join("\n"),
  "long-labels": [
    "flowchart TD",
    "You --> Arcadia",
    'Arcadia -->|"route"| LLM',
    'Arcadia -->|"invoke"| Tools --> GenUI["Structured UI"]',
  ].join("\n"),
};

export function useGenUiMermaidDiagramDemo(active = true) {
  return useGenUiArrangementCycle(LAB_DIAGRAM_PRESETS, active);
}

type MermaidDiagramDemoState = ReturnType<typeof useGenUiMermaidDiagramDemo>;

export function GenUiMermaidDiagramDemoToolbar({ demo }: { demo: MermaidDiagramDemoState }) {
  return <GenUiArrangementToolbar cycle={demo} groupLabel="Diagram states" noun="state" />;
}

/** The real chat diagram, unwrapped: no lab card around the well the component already draws. */
export function GenUiMermaidDiagramDemo({
  demo,
  condensed = false,
}: {
  demo: MermaidDiagramDemoState;
  condensed?: boolean;
}) {
  const preset = demo.arrangement;

  const code = condensed ? CONDENSED_DIAGRAMS[preset.id] : undefined;
  const output = code
    ? { ...preset.output, code, overviewCode: code, density: "glance" }
    : preset.output;

  const diagram = (
    /* Keyed by preset so each step remounts and replays the arrival reveal. */
    <MermaidToolDiagram
      key={preset.id}
      interactive
      output={output}
      toolCallId={`lab-diagram-${preset.id}`}
    />
  );

  return (
    <GenUiArrangementPauseZone cycle={demo}>
      {condensed ? <div className="mx-auto w-full max-w-sm">{diagram}</div> : diagram}
    </GenUiArrangementPauseZone>
  );
}
