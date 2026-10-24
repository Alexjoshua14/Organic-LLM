import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { RABBIT_HOLE_GRAPH_NODE_LIMIT } from "@/lib/rabbit-holes/graph-context-models";

export type RelatedNodeRole = "ancestor" | "lateral";

export type RelatedNodeRef = {
  nodeId: string;
  role: RelatedNodeRole;
};

function buildChildrenByParent(session: RabbitHoleSession): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>();

  for (const seg of session.path) {
    if (!seg.parentNodeId) continue;

    const list = childrenByParent.get(seg.parentNodeId) ?? [];

    list.push(seg.nodeId);
    childrenByParent.set(seg.parentNodeId, list);
  }

  return childrenByParent;
}

/** Nearest-first chain from anchor up to root (includes anchor). */
export function collectAncestorNodeIds(
  session: RabbitHoleSession,
  anchorNodeId: string | null
): string[] {
  if (!anchorNodeId) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  let current: string | null = anchorNodeId;

  while (current && !seen.has(current)) {
    seen.add(current);
    result.push(current);

    const seg = session.path.find((s) => s.nodeId === current);

    current = seg?.parentNodeId ?? null;
  }

  return result;
}

/**
 * Nodes outside the ancestor chain (sibling branches and their subtrees), ordered by path position (recent first).
 */
export function collectLateralNodeIds(
  session: RabbitHoleSession,
  ancestorIds: readonly string[],
  excludeNodeId: string
): string[] {
  const ancestorSet = new Set(ancestorIds);
  const pathOrder = new Map(session.path.map((seg, index) => [seg.nodeId, index]));

  return Object.keys(session.nodesById)
    .filter((id) => id !== excludeNodeId && !ancestorSet.has(id))
    .sort((a, b) => (pathOrder.get(b) ?? 0) - (pathOrder.get(a) ?? 0));
}

/**
 * Split `limit` evenly between ancestors and lateral nodes, then fill spare slots from the larger pool.
 */
export function balanceTwoPools(
  ancestors: readonly string[],
  lateral: readonly string[],
  limit: number
): RelatedNodeRef[] {
  if (limit <= 0) return [];

  const half = Math.floor(limit / 2);
  let ancestorTake = Math.min(ancestors.length, half);
  let lateralTake = Math.min(lateral.length, half);
  let remaining = limit - ancestorTake - lateralTake;

  const ancestorSpare = ancestors.length - ancestorTake;
  const lateralSpare = lateral.length - lateralTake;

  if (remaining > 0 && ancestorSpare > 0) {
    const extra = Math.min(remaining, ancestorSpare);

    ancestorTake += extra;
    remaining -= extra;
  }

  if (remaining > 0 && lateralSpare > 0) {
    lateralTake += Math.min(remaining, lateralSpare);
  }

  const refs: RelatedNodeRef[] = [];

  for (const nodeId of ancestors.slice(0, ancestorTake)) {
    refs.push({ nodeId, role: "ancestor" });
  }

  for (const nodeId of lateral.slice(0, lateralTake)) {
    refs.push({ nodeId, role: "lateral" });
  }

  return refs;
}

export type CollectRelatedNodesOptions = {
  /** Parent of the node being generated; null for a root node. */
  anchorNodeId: string | null;
  /** Node currently being generated (excluded from context). */
  excludeNodeId: string;
  /** Max ancestors + lateral nodes before rerank (default 100). */
  limit?: number;
};

/**
 * Collect up to `limit` related article nodes: balanced ancestors (parent chain) + lateral branches.
 */
export function collectBalancedRelatedNodeRefs(
  session: RabbitHoleSession,
  options: CollectRelatedNodesOptions
): RelatedNodeRef[] {
  const limit = options.limit ?? RABBIT_HOLE_GRAPH_NODE_LIMIT;
  const ancestors = collectAncestorNodeIds(session, options.anchorNodeId);
  const lateral = collectLateralNodeIds(session, ancestors, options.excludeNodeId);

  return balanceTwoPools(ancestors, lateral, limit);
}

/** Resolve parent node id for a node being generated. */
export function parentNodeIdForGeneration(
  session: RabbitHoleSession,
  nodeId: string
): string | null {
  return session.path.find((seg) => seg.nodeId === nodeId)?.parentNodeId ?? null;
}
