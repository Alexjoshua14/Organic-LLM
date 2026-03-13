import { describe, expect, test } from "bun:test";

import { nodeToRabbitHoleNodeRow } from "@/data/supabase/rabbitHoleNodeRow";

const baseNode = {
  id: "node-1",
  rawPrompt: "What is X?",
  userQuestion: "What is X?",
  articleHtml: "",
  createdAt: new Date().toISOString(),
};

describe("nodeToRabbitHoleNodeRow", () => {
  test("uses placeholder key_takeaways when keyTakeaways is empty", () => {
    const row = nodeToRabbitHoleNodeRow(
      { ...baseNode, keyTakeaways: [] },
      "session-1",
    );
    expect(row.key_takeaways).toHaveLength(3);
    expect(row.key_takeaways[0]).toBe("Generating…");
    expect(row.key_takeaways[1]).toBe("…");
    expect(row.key_takeaways[2]).toBe("…");
    expect(row.session_id).toBe("session-1");
    expect(row.node_id).toBe("node-1");
  });

  test("pads to 3 preserving real keyTakeaways when length is 1", () => {
    const row = nodeToRabbitHoleNodeRow(
      { ...baseNode, keyTakeaways: ["Only one"] },
      "session-2",
    );
    expect(row.key_takeaways).toHaveLength(3);
    expect(row.key_takeaways[0]).toBe("Only one");
    expect(row.key_takeaways[1]).toBe("Generating…");
    expect(row.key_takeaways[2]).toBe("…");
  });

  test("pads to 3 preserving real keyTakeaways when length is 2", () => {
    const row = nodeToRabbitHoleNodeRow(
      { ...baseNode, keyTakeaways: ["First", "Second"] },
      "session-3",
    );
    expect(row.key_takeaways).toHaveLength(3);
    expect(row.key_takeaways[0]).toBe("First");
    expect(row.key_takeaways[1]).toBe("Second");
    expect(row.key_takeaways[2]).toBe("Generating…");
  });

  test("uses node keyTakeaways unchanged when length is 3", () => {
    const takeaways = ["Point A", "Point B", "Point C"];
    const row = nodeToRabbitHoleNodeRow(
      { ...baseNode, keyTakeaways: takeaways },
      "session-4",
    );
    expect(row.key_takeaways).toHaveLength(3);
    expect(row.key_takeaways[0]).toBe("Point A");
    expect(row.key_takeaways[1]).toBe("Point B");
    expect(row.key_takeaways[2]).toBe("Point C");
  });

  test("uses node keyTakeaways unchanged when length is 6", () => {
    const takeaways = ["A", "B", "C", "D", "E", "F"];
    const row = nodeToRabbitHoleNodeRow(
      { ...baseNode, keyTakeaways: takeaways },
      "session-5",
    );
    expect(row.key_takeaways).toHaveLength(6);
    expect(row.key_takeaways[0]).toBe("A");
    expect(row.key_takeaways[1]).toBe("B");
    expect(row.key_takeaways[2]).toBe("C");
    expect(row.key_takeaways[3]).toBe("D");
    expect(row.key_takeaways[4]).toBe("E");
    expect(row.key_takeaways[5]).toBe("F");
  });

  test("maps all node fields to row shape", () => {
    const createdAt = "2025-01-15T12:00:00.000Z";
    const row = nodeToRabbitHoleNodeRow(
      {
        ...baseNode,
        keyTakeaways: ["K1", "K2", "K3"],
        createdAt,
      },
      "sess-99",
    );
    expect(row.session_id).toBe("sess-99");
    expect(row.node_id).toBe("node-1");
    expect(row.raw_prompt).toBe("What is X?");
    expect(row.user_question).toBe("What is X?");
    expect(row.article_html).toBe("");
    expect(row.created_at).toBe(createdAt);
  });
});
