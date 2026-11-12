"use client";

import {
  MERMAID_DENSE_DETAILED,
  MERMAID_DENSE_OVERVIEW,
  MERMAID_DUAL_SOURCE_OUTPUT,
  MERMAID_FLOWCHART_EDGE_LABELS,
  MERMAID_LONG_LABELS_OVERVIEW,
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

export const LAB_DIAGRAM_PRESETS: ReadonlyArray<DiagramPreset> = [
  {
    id: "glance",
    name: "Glance",
    intent: "Four nodes punctuate the prose. A visual aside, still expandable.",
    output: {
      success: true,
      density: "glance",
      title: "Order request check",
      overviewCode: MERMAID_FLOWCHART_EDGE_LABELS,
    },
  },
  {
    id: "overview",
    name: "Overview",
    intent:
      "The answer's structure, readable inline. Expand opens on the same gist, with detail one step away.",
    output: {
      success: true,
      density: "overview",
      title: "Chat request path",
      overviewCode: MERMAID_DENSE_OVERVIEW,
      detailedCode: MERMAID_DENSE_DETAILED,
    },
  },
  {
    id: "detailed",
    name: "Detailed",
    intent:
      "A reference you go into. Inline still shows the overview; expand opens straight on all 14 nodes.",
    output: { ...MERMAID_DUAL_SOURCE_OUTPUT },
  },
  {
    id: "long-labels",
    name: "Long labels",
    intent: "Wrapping node and edge labels, to check legibility and width inside the well.",
    output: {
      success: true,
      density: "overview",
      title: "Chat request path, annotated",
      overviewCode: MERMAID_LONG_LABELS_OVERVIEW,
    },
  },
];

export function useGenUiMermaidDiagramDemo(active = true) {
  return useGenUiArrangementCycle(LAB_DIAGRAM_PRESETS, active);
}

type MermaidDiagramDemoState = ReturnType<typeof useGenUiMermaidDiagramDemo>;

export function GenUiMermaidDiagramDemoToolbar({ demo }: { demo: MermaidDiagramDemoState }) {
  return <GenUiArrangementToolbar cycle={demo} groupLabel="Diagram presets" noun="preset" />;
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
