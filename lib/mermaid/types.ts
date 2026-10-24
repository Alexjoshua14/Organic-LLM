/** Model-declared presentation tier for a generated diagram. */
export type MermaidDiagramDensity = "glance" | "overview" | "detailed";

/** Dual-source payload from `make_mermaid_diagram`. */
export type MermaidDiagramPayload = {
  success: true;
  density: MermaidDiagramDensity;
  title?: string | null;
  diagramType?: string | null;
  overviewCode: string;
  detailedCode: string;
  generatorModelId?: string;
  validationError?: string | null;
  /** Legacy single-source field — mirrors overviewCode when present. */
  code?: string;
};

/** A node linked into the composer for the next user message. */
export type DiagramNodeLink = {
  id: string;
  diagramId: string;
  nodeId: string;
  label: string;
  title?: string;
  density?: MermaidDiagramDensity;
  neighborhood: DiagramNodeNeighborhood;
};

export type DiagramNodeNeighborhood = {
  edges: { from: string; to: string; label?: string }[];
  neighbors: { id: string; label: string }[];
};

export const DIAGRAM_NODE_LINK_CAP = 10;
