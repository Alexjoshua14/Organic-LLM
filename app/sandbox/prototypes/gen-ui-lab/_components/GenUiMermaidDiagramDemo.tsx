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

export function useGenUiMermaidDiagramDemo(active = true) {
  return useGenUiArrangementCycle(LAB_DIAGRAM_PRESETS, active);
}

type MermaidDiagramDemoState = ReturnType<typeof useGenUiMermaidDiagramDemo>;

export function GenUiMermaidDiagramDemoToolbar({ demo }: { demo: MermaidDiagramDemoState }) {
  return <GenUiArrangementToolbar cycle={demo} groupLabel="Diagram states" noun="state" />;
}

/** The real chat diagram, unwrapped: no lab card around the well the component already draws. */
export function GenUiMermaidDiagramDemo({ demo }: { demo: MermaidDiagramDemoState }) {
  const preset = demo.arrangement;

  return (
    <GenUiArrangementPauseZone cycle={demo}>
      {/* Keyed by preset so each step remounts and replays the arrival reveal. */}
      <MermaidToolDiagram
        key={preset.id}
        interactive
        output={preset.output}
        toolCallId={`lab-diagram-${preset.id}`}
      />
    </GenUiArrangementPauseZone>
  );
}
