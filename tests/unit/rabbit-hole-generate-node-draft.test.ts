import { describe, expect, test } from "bun:test";

import { draftGeneratedRabbitHoleNode } from "@/lib/llm/rabbit-hole-assistant-tools";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const PARENT_ID = "660e8400-e29b-41d4-a716-446655440001";
const NODE_ID = "770e8400-e29b-41d4-a716-446655440002";

function emptyChatSession(): RabbitHoleSession {
  return {
    sessionId: SESSION_ID,
    rootQuestion: "",
    rootNodeId: null,
    path: [],
    nodesById: {},
    activeNodeId: null,
    edges: [],
    createdAt: "2026-10-21T00:00:00.000Z",
  };
}

describe("draftGeneratedRabbitHoleNode", () => {
  test("activates the new node, names an empty chat, and emits a root with no edge", () => {
    const drafted = draftGeneratedRabbitHoleNode({
      session: emptyChatSession(),
      query: "Cursor Auto vs. Organic LLM: Transparent Model Routing",
      activeNodeId: null,
      nodeId: NODE_ID,
      now: "2026-10-21T00:00:01.000Z",
    });

    expect(drafted.title).toBe("Cursor Auto vs. Organic LLM: Transparent Model Routing");
    expect(drafted.session.activeNodeId).toBe(NODE_ID);
    expect(drafted.session.rootNodeId).toBe(NODE_ID);
    expect(drafted.session.rootQuestion).toBe(drafted.title);
    expect(drafted.session.generatingNodeId).toBe(NODE_ID);
    expect(drafted.session.edges).toEqual([]);
    expect(drafted.session.path[0]?.parentNodeId).toBeNull();
    expect(drafted.session.nodesById[NODE_ID]?.title).toBe(drafted.title);
  });

  test("appends an edge when a parent exists and keeps an existing root question", () => {
    const session = emptyChatSession();

    session.rootQuestion = "How routing works";
    session.rootNodeId = PARENT_ID;
    session.activeNodeId = PARENT_ID;
    session.path = [{ nodeId: PARENT_ID, label: "How routing works", parentNodeId: null }];
    session.nodesById[PARENT_ID] = {
      id: PARENT_ID,
      rawPrompt: "How routing works",
      userQuestion: "How routing works",
      title: "How routing works",
      keyTakeaways: ["a", "b", "c"],
      articleHtml: "<p>Parent</p>",
      createdAt: session.createdAt,
    };

    const drafted = draftGeneratedRabbitHoleNode({
      session,
      query: "Where the budget check runs",
      activeNodeId: PARENT_ID,
      nodeId: NODE_ID,
      now: "2026-10-21T00:00:02.000Z",
    });

    expect(drafted.session.rootQuestion).toBe("How routing works");
    expect(drafted.session.rootNodeId).toBe(PARENT_ID);
    expect(drafted.session.activeNodeId).toBe(NODE_ID);
    expect(drafted.session.edges).toEqual([{ from: PARENT_ID, to: NODE_ID }]);
    expect(drafted.session.path.at(-1)?.parentNodeId).toBe(PARENT_ID);
  });
});
