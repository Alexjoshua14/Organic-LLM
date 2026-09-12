"use client";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { parseMermaidDiagramPayload } from "@/lib/mermaid/source";

type MermaidToolDiagramProps = {
  output: unknown;
  toolCallId: string;
  interactive?: boolean;
};

/** Inline diagram from `make_mermaid_diagram` dual-source tool output. */
export function MermaidToolDiagram({
  output,
  toolCallId,
  interactive = true,
}: MermaidToolDiagramProps) {
  const payload = parseMermaidDiagramPayload(output);

  if (!payload) return null;

  return (
    <MermaidDiagram
      code={payload.overviewCode}
      density={payload.density}
      detailedCode={payload.detailedCode}
      diagramId={toolCallId}
      expandOnDoubleClick
      interactive={interactive}
      overviewCode={payload.overviewCode}
      title={payload.title ?? undefined}
    />
  );
}
