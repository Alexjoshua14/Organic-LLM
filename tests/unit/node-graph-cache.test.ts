import { describe, expect, test } from "bun:test";

import {
  buildNodeGraphCache,
  enabledNodeIdsForActive,
  MAX_RABBIT_HOLE_GRAPH_DEPTH,
} from "@/lib/rabbit-holes/node-graph-cache";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

function makeLinearSession(depth: number): RabbitHoleSession {
  const path: RabbitHoleSession["path"] = [];
  const nodesById: RabbitHoleSession["nodesById"] = {};

  for (let i = 0; i < depth; i += 1) {
    const nodeId = `n${i}`;

    path.push({
      nodeId,
      label: `Node ${i}`,
      parentNodeId: i > 0 ? `n${i - 1}` : undefined,
    });
    nodesById[nodeId] = {
      id: nodeId,
      rawPrompt: `Q${i}`,
      userQuestion: `Q${i}`,
      keyTakeaways: ["a", "b", "c"],
      createdAt: new Date().toISOString(),
    };
  }

  return {
    sessionId: "s1",
    rootQuestion: "Root",
    path,
    nodesById,
    activeNodeId: `n${depth - 1}`,
    edges: [],
    createdAt: new Date().toISOString(),
  };
}

describe("node-graph-cache", () => {
  test("builds ancestor and descendant sets", () => {
    const session = makeLinearSession(4);
    const cache = buildNodeGraphCache(session);
    const enabled = enabledNodeIdsForActive(cache, "n2");

    expect(enabled.has("n0")).toBe(true);
    expect(enabled.has("n2")).toBe(true);
    expect(enabled.has("n3")).toBe(true);
  });

  test("depth cap constant is 100", () => {
    expect(MAX_RABBIT_HOLE_GRAPH_DEPTH).toBe(100);
  });
});
