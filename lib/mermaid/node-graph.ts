import type { DiagramNodeNeighborhood } from "@/lib/mermaid/types";

/** Flowchart / state node id patterns: `NodeId["label"]` or bare `NodeId`. */
const FLOW_NODE_RE =
  /^\s*([A-Za-z_][\w-]*)\s*(?:\[[^\]]*\]|\([^)]*\)|\{\{[^}]*\}\}|\([^)]*\)|\(\[[^\]]*\]\))?/;

const EDGE_RE =
  /^\s*([A-Za-z_][\w-]*)(?:\[[^\]]*\]|\([^)]*\)|\{\{[^}]*\}\}|\(\[[^\]]*\]\))?\s*(?:-->|---|-.->|==>|--o|--x|~~~)\s*(?:\|[^|]*\|\s*)?([A-Za-z_][\w-]*)(?:\[[^\]]*\]|\([^)]*\)|\{\{[^}]*\}\}|\(\[[^\]]*\]\))?/;

const PARTICIPANT_RE = /^\s*participant\s+([A-Za-z_][\w-]*)/i;

const STATE_TRANSITION_RE = /^\s*([A-Za-z_][\w-]*)\s*-->\s*([A-Za-z_][\w-]*)/;

/** Extract node/participant IDs from Mermaid source (best-effort). */
export function extractMermaidNodeIds(source: string): string[] {
  const ids = new Set<string>();

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("%%") || line.startsWith("subgraph") || line === "end") {
      continue;
    }

    const participant = line.match(PARTICIPANT_RE);

    if (participant?.[1]) {
      ids.add(participant[1]);
      continue;
    }

    const edge = line.match(EDGE_RE) ?? line.match(STATE_TRANSITION_RE);

    if (edge?.[1]) ids.add(edge[1]);
    if (edge?.[2]) ids.add(edge[2]);

    const node = line.match(FLOW_NODE_RE);

    if (node?.[1] && !["flowchart", "graph", "stateDiagram-v2", "sequenceDiagram"].includes(node[1])) {
      ids.add(node[1]);
    }
  }

  return [...ids];
}

/** Label from `NodeId["Human label"]` or the id itself. */
export function extractNodeLabel(source: string, nodeId: string): string {
  const re = new RegExp(
    `\\b${escapeRegExp(nodeId)}\\s*\\[\\s*"([^"]+)"\\s*\\]|\\b${escapeRegExp(nodeId)}\\s*\\[\\s*([^\\]]+)\\s*\\]`,
    "i"
  );
  const match = source.match(re);

  if (match?.[1]) return match[1].trim();
  if (match?.[2]) return match[2].trim();

  return nodeId;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** IDs present in overview must be a subset of detailed when both are provided. */
export function validateSharedNodeIds(overviewCode: string, detailedCode: string): string | null {
  const overviewIds = new Set(extractMermaidNodeIds(overviewCode));
  const detailedIds = new Set(extractMermaidNodeIds(detailedCode));

  if (overviewIds.size === 0 || detailedIds.size === 0) return null;

  const missing: string[] = [];

  for (const id of overviewIds) {
    if (!detailedIds.has(id)) missing.push(id);
  }

  if (missing.length === 0) return null;

  return `Overview nodes missing from detailed rendering: ${missing.join(", ")}`;
}

/** Immediate neighbors and connecting edges for a node. */
export function buildNodeNeighborhood(source: string, nodeId: string): DiagramNodeNeighborhood {
  const edges: DiagramNodeNeighborhood["edges"] = [];
  const neighborIds = new Set<string>();

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();

    const edgeMatch =
      line.match(
        new RegExp(
          `^(${escapeRegExp(nodeId)})(?:\\[[^\\]]*\\]|\\([^)]*\\))?\\s*(?:-->|---|-.->|==>|--o|--x|~~~)\\s*(?:\\|([^|]*)\\|\\s*)?([A-Za-z_][\\w-]*)(?:\\[[^\\]]*\\]|\\([^)]*\\))?`,
          "i"
        )
      ) ??
      line.match(
        new RegExp(
          `^([A-Za-z_][\\w-]*)(?:\\[[^\\]]*\\]|\\([^)]*\\))?\\s*(?:-->|---|-.->|==>|--o|--x|~~~)\\s*(?:\\|([^|]*)\\|\\s*)?(${escapeRegExp(nodeId)})(?:\\[[^\\]]*\\]|\\([^)]*\\))?`,
          "i"
        )
      );

    if (edgeMatch) {
      const from = edgeMatch[1];
      const to = edgeMatch[3];
      const label = edgeMatch[2]?.trim() || undefined;

      edges.push({ from, to, label });
      if (from !== nodeId) neighborIds.add(from);
      if (to !== nodeId) neighborIds.add(to);
    }
  }

  const neighbors = [...neighborIds].map((id) => ({
    id,
    label: extractNodeLabel(source, id),
  }));

  return { edges, neighbors };
}

/** Compact context block for the model when a node is linked in the composer. */
export function formatDiagramNodeContext(link: {
  label: string;
  title?: string;
  density?: string;
  neighborhood: DiagramNodeNeighborhood;
}): string {
  const lines = [
    "[Diagram node context]",
    link.title ? `Diagram: ${link.title}` : undefined,
    link.density ? `Density: ${link.density}` : undefined,
    `Focus node: ${link.label}`,
  ].filter(Boolean) as string[];

  if (link.neighborhood.neighbors.length > 0) {
    lines.push(
      "Neighbors:",
      ...link.neighborhood.neighbors.map((n) => `- ${n.label} (${n.id})`)
    );
  }

  if (link.neighborhood.edges.length > 0) {
    lines.push(
      "Edges:",
      ...link.neighborhood.edges.map((e) => {
        const lbl = e.label ? ` "${e.label}"` : "";

        return `- ${e.from} -->${lbl} ${e.to}`;
      })
    );
  }

  return lines.join("\n");
}
