import { describe, expect, test } from "bun:test";

import {
  balanceTwoPools,
  collectAncestorNodeIds,
  collectBalancedRelatedNodeRefs,
  collectLateralNodeIds,
} from "@/lib/rabbit-holes/collect-related-nodes";
import {
  RABBIT_HOLE_GRAPH_NODE_LIMIT,
  RABBIT_HOLE_GRAPH_RERANKED_LIMIT_DEFAULT,
  RABBIT_HOLE_NODE_SUMMARY_MAX_OUTPUT_TOKENS,
} from "@/lib/rabbit-holes/graph-context-models";
import { rerankDocumentsLexical } from "@/lib/rabbit-holes/rerank-document-chunks";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

function makeBranchingSession(): RabbitHoleSession {
  const nodesById: RabbitHoleSession["nodesById"] = {
    root: {
      id: "root",
      rawPrompt: "Root",
      userQuestion: "Root Q",
      keyTakeaways: ["r1", "r2", "r3"],
      articleHtml: "<p>root article</p>",
      summary: "Root summary about quantum physics",
      createdAt: new Date().toISOString(),
    },
    a: {
      id: "a",
      rawPrompt: "A",
      userQuestion: "Branch A",
      keyTakeaways: ["a1", "a2", "a3"],
      articleHtml: "<p>a article</p>",
      summary: "Branch A summary about entanglement",
      createdAt: new Date().toISOString(),
    },
    b: {
      id: "b",
      rawPrompt: "B",
      userQuestion: "Branch B",
      keyTakeaways: ["b1", "b2", "b3"],
      articleHtml: "<p>b article</p>",
      summary: "Branch B summary about cooking pasta",
      createdAt: new Date().toISOString(),
    },
    newNode: {
      id: "newNode",
      rawPrompt: "New",
      userQuestion: "Quantum entanglement deep dive",
      keyTakeaways: [],
      createdAt: new Date().toISOString(),
    },
  };

  return {
    sessionId: "sess-1",
    rootQuestion: "Root Q",
    rootNodeId: "root",
    path: [
      { nodeId: "root", label: "Root", parentNodeId: null },
      { nodeId: "a", label: "A", parentNodeId: "root" },
      { nodeId: "b", label: "B", parentNodeId: "root" },
      { nodeId: "newNode", label: "New", parentNodeId: "a" },
    ],
    nodesById,
    activeNodeId: "newNode",
    edges: [],
    createdAt: new Date().toISOString(),
  };
}

describe("graph context models", () => {
  test("defaults match product limits", () => {
    expect(RABBIT_HOLE_GRAPH_NODE_LIMIT).toBe(100);
    expect(RABBIT_HOLE_GRAPH_RERANKED_LIMIT_DEFAULT).toBe(90);
    expect(RABBIT_HOLE_NODE_SUMMARY_MAX_OUTPUT_TOKENS).toBe(2000);
  });
});

describe("collect-related-nodes", () => {
  test("collects ancestor chain nearest-first", () => {
    const session = makeBranchingSession();

    expect(collectAncestorNodeIds(session, "a")).toEqual(["a", "root"]);
  });

  test("collects lateral branches excluding ancestors", () => {
    const session = makeBranchingSession();
    const ancestors = collectAncestorNodeIds(session, "a");

    expect(collectLateralNodeIds(session, ancestors, "newNode")).toEqual(["b"]);
  });

  test("balances ancestor and lateral pools up to limit", () => {
    const balanced = balanceTwoPools(["a", "root"], ["b", "c", "d"], 4);

    expect(balanced).toHaveLength(4);
    expect(balanced.filter((r) => r.role === "ancestor")).toHaveLength(2);
    expect(balanced.filter((r) => r.role === "lateral")).toHaveLength(2);
  });

  test("collectBalancedRelatedNodeRefs excludes generating node", () => {
    const session = makeBranchingSession();
    const refs = collectBalancedRelatedNodeRefs(session, {
      anchorNodeId: "a",
      excludeNodeId: "newNode",
      limit: 10,
    });

    const ids = refs.map((r) => r.nodeId);

    expect(ids).not.toContain("newNode");
    expect(ids).toContain("a");
    expect(ids).toContain("root");
    expect(ids).toContain("b");
  });
});

describe("rerankDocumentsLexical", () => {
  test("ranks entanglement summary above cooking for quantum query", () => {
    const ranked = rerankDocumentsLexical({
      query: "quantum entanglement",
      documents: [
        { text: "Branch B summary about cooking pasta", meta: { id: "b" } },
        { text: "Branch A summary about entanglement", meta: { id: "a" } },
      ],
      topN: 2,
    });

    expect(ranked[0]?.meta).toEqual({ id: "a" });
  });

  test("respects topN reranked limit", () => {
    const ranked = rerankDocumentsLexical({
      query: "quantum",
      documents: [
        { text: "one", meta: 1 },
        { text: "two", meta: 2 },
        { text: "three quantum", meta: 3 },
      ],
      topN: 1,
    });

    expect(ranked).toHaveLength(1);
  });
});
