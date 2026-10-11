import type { UIMessage } from "ai";
import type { SubagentBoardEntry } from "@/lib/arcadia/multitask/board-sync";

import { describe, expect, test } from "bun:test";

import { mergeSubagentBoard } from "@/lib/arcadia/multitask/board-sync";
import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import {
  buildSubagentGoalMessage,
  buildSubagentReplyMessage,
} from "@/lib/llm/subagents/threads/messages";
import { buildSubagentThreadSnapshot } from "@/lib/llm/subagents/threads/snapshot";

const row = { threadId: "child", agentId: "agent-coder", status: "working", statusAt: null };
const assignment = (modelId?: string) =>
  buildSubagentGoalMessage({ goal: "Review.", goalId: "g2", modelId });
const reply = buildSubagentReplyMessage({ text: "Done.", goalId: "g1", modelId: "previous-model" });

describe("subagent model identity", () => {
  test("a newly dispatched assignment overrides the previous reply's model before completion", () => {
    expect(buildSubagentThreadSnapshot(row, [reply, assignment("next-model")]).modelId).toBe(
      "next-model"
    );
    expect(buildSubagentThreadSnapshot(row, [assignment("next-model"), reply]).modelId).toBe(
      "previous-model"
    );
  });

  test("legacy assignments never inherit a stale model, and legacy replies still expose theirs", () => {
    expect(buildSubagentThreadSnapshot(row, [reply, assignment()]).modelId).toBeNull();
    expect(buildSubagentThreadSnapshot(row, [reply]).modelId).toBe("previous-model");
    expect(buildSubagentThreadSnapshot(row, []).modelId).toBeNull();
  });

  test("direct chat replies use the persisted model, and user text cannot supply a model label", () => {
    const directReply = {
      id: "direct",
      role: "assistant",
      model: "direct-model",
      parts: [],
    } as UIMessage;
    const note: UIMessage = {
      id: "note",
      role: "user",
      metadata: { modelId: "fake-model" },
      parts: [],
    };

    expect(buildSubagentThreadSnapshot(row, [reply, directReply, note]).modelId).toBe(
      "direct-model"
    );
    expect(buildSubagentThreadSnapshot(row, [note]).modelId).toBeNull();
  });

  test("a model-only poll update reaches the card and unknown metadata clears an old label", () => {
    const agent = createDemoSubagents().find((a) => a.id === row.agentId)!;
    const entry: SubagentBoardEntry = {
      ...row,
      name: agent.name,
      role: agent.role,
      status: "working",
      goal: "Review.",
      outcome: null,
      modelId: "first-model",
    };
    const [first] = mergeSubagentBoard([agent], [entry]);
    const [same] = mergeSubagentBoard([first!], [entry]);
    const [changed] = mergeSubagentBoard([first!], [{ ...entry, modelId: "second-model" }]);
    const [unknown] = mergeSubagentBoard([changed!], [{ ...entry, modelId: null }]);

    expect(same).toBe(first);
    expect(changed).not.toBe(first);
    expect(changed?.modelId).toBe("second-model");
    expect(unknown?.modelId).toBeNull();
  });
});
