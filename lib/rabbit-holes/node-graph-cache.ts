import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

export const MAX_RABBIT_HOLE_GRAPH_DEPTH = 100;

export type NodeGraphCache = {
  ancestors: Map<string, Set<string>>;
  descendants: Map<string, Set<string>>;
};

function warnDepthTruncation(direction: "ancestors" | "descendants", excluded: number) {
  if (excluded > 0) {
    console.warn(
      `[rabbit-hole] MAX_RABBIT_HOLE_GRAPH_DEPTH (${MAX_RABBIT_HOLE_GRAPH_DEPTH}) reached while collecting ${direction}; ${excluded} node(s) excluded. See lib/rabbit-holes/node-graph-cache.ts`
    );
  }
}

export function buildNodeGraphCache(session: RabbitHoleSession): NodeGraphCache {
  const childrenByParent = new Map<string, string[]>();

  for (const seg of session.path) {
    if (!seg.parentNodeId) continue;

    const list = childrenByParent.get(seg.parentNodeId) ?? [];

    list.push(seg.nodeId);
    childrenByParent.set(seg.parentNodeId, list);
  }

  const ancestors = new Map<string, Set<string>>();
  const descendants = new Map<string, Set<string>>();

  const collectAncestors = (nodeId: string): Set<string> => {
    const cached = ancestors.get(nodeId);

    if (cached) return cached;

    const set = new Set<string>([nodeId]);
    let excluded = 0;
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depth >= MAX_RABBIT_HOLE_GRAPH_DEPTH) {
        excluded += 1;
        continue;
      }

      const seg = session.path.find((s) => s.nodeId === id);

      if (seg?.parentNodeId) {
        set.add(seg.parentNodeId);
        queue.push({ id: seg.parentNodeId, depth: depth + 1 });
      }
    }

    warnDepthTruncation("ancestors", excluded);
    ancestors.set(nodeId, set);

    return set;
  };

  const collectDescendants = (nodeId: string): Set<string> => {
    const cached = descendants.get(nodeId);

    if (cached) return cached;

    const set = new Set<string>([nodeId]);
    let excluded = 0;
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depth >= MAX_RABBIT_HOLE_GRAPH_DEPTH) {
        excluded += 1;
        continue;
      }

      for (const childId of childrenByParent.get(id) ?? []) {
        set.add(childId);
        queue.push({ id: childId, depth: depth + 1 });
      }
    }

    warnDepthTruncation("descendants", excluded);
    descendants.set(nodeId, set);

    return set;
  };

  for (const nodeId of Object.keys(session.nodesById)) {
    collectAncestors(nodeId);
    collectDescendants(nodeId);
  }

  return { ancestors, descendants };
}

export function enabledNodeIdsForActive(cache: NodeGraphCache, activeNodeId: string): Set<string> {
  const up = cache.ancestors.get(activeNodeId) ?? new Set([activeNodeId]);
  const down = cache.descendants.get(activeNodeId) ?? new Set([activeNodeId]);
  const merged = new Set<string>([...up, ...down]);

  return merged;
}

export function invalidateNodeGraphCache(_cache: NodeGraphCache): NodeGraphCache {
  return {
    ancestors: new Map(),
    descendants: new Map(),
  };
}
