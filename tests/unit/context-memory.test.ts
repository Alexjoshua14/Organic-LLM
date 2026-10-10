import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import {
  composeContextBudget,
  getMessageToolPartsForTokenEstimate,
  mergePreservedLastTurn,
} from "@/lib/chat/context-budget";
import {
  getContextMemoryReferences,
  memoryReferencesFromToolResult,
  summarizeContextMemories,
} from "@/lib/chat/context-memory";
import { withActivatedMemories } from "@/lib/memory/activated-thread-memories";

const user = (id: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text: "Hello" }],
});

describe("working context memories", () => {
  test("deduplicates retained, automatic, and tool-fetched memories without counting the inventory", () => {
    const messages: UIMessage[] = [
      withActivatedMemories(user("u1"), [{ id: "a", text: "First fact" }]),
      withActivatedMemories(user("u2"), [
        { id: "a", text: "First fact" },
        { id: "b", text: "Second fact" },
      ]),
      {
        id: "a2",
        role: "assistant",
        parts: [
          {
            type: "tool-search_memories",
            toolCallId: "call",
            state: "output-available",
            input: { query: "facts" },
            output: {
              success: true,
              count: 99,
              memories: [
                { id: "b", memory: "Second fact" },
                { id: "c", memory: "Third fact" },
              ],
              memoryInventory: { total: 99 },
            },
          },
        ],
      },
    ];
    const references = getContextMemoryReferences(messages);

    expect(summarizeContextMemories(references)).toEqual({
      total: 3,
      automatic: 2,
      tools: 2,
      overlap: 1,
    });
    expect(summarizeContextMemories(references.filter((ref) => ref.messageId === "u2")).total).toBe(
      2
    );
  });

  test("ignores failed, pending and unrelated tools; includes dynamic recent-memory results", () => {
    expect(
      memoryReferencesFromToolResult(
        "search_memories",
        { success: false, memories: [{ id: "x", memory: "Failed" }] },
        "a"
      )
    ).toEqual([]);
    expect(
      memoryReferencesFromToolResult(
        "web_search",
        { memories: [{ id: "x", memory: "Other" }] },
        "a"
      )
    ).toEqual([]);
    const references = getContextMemoryReferences([
      {
        id: "a",
        role: "assistant",
        parts: [
          {
            type: "tool-search_memories",
            toolCallId: "pending",
            state: "input-available",
            input: { query: "q" },
          },
          {
            type: "dynamic-tool",
            toolName: "list_recent_memories",
            toolCallId: "recent",
            state: "output-available",
            input: { window: "day" },
            output: {
              success: true,
              memories: [
                { id: "x", memory: "Fact" },
                { id: "empty", memory: " " },
              ],
            },
          },
        ],
      },
    ]);

    expect(references).toEqual([{ id: "x", messageId: "a", source: "tool" }]);
  });

  test("keeps anonymous facts deduplicated without putting their text in HUD metadata", () => {
    const automatic = getContextMemoryReferences([
      withActivatedMemories(user("u"), [{ id: "text:private fact", text: "Private fact" }]),
    ]);
    const tools = memoryReferencesFromToolResult(
      "search_memories",
      { memories: [{ memory: "Private fact" }] },
      "a"
    );

    expect(summarizeContextMemories([...automatic, ...tools]).total).toBe(1);
    expect(JSON.stringify([...automatic, ...tools])).not.toContain("private fact");
  });

  test("preserves streamed references across polls but drops memories outside the packed window", () => {
    const previous = {
      memoryContext: [
        { id: "old", messageId: "u1", source: "automatic" as const },
        { id: "new", messageId: "u2", source: "automatic" as const },
      ],
    };
    const scaffold = mergePreservedLastTurn(
      {
        systemTokens: 0,
        toolsTokens: 0,
        summaryTokens: 0,
        memoryTokens: 0,
        activeToolNames: [],
        contextMessageLimit: 1,
        source: "server" as const,
      },
      previous
    );
    const budget = composeContextBudget({
      scaffold,
      threadMessages: [user("u1"), user("u2")],
      draftText: "",
      modelId: "openai/gpt-6-sol",
    });

    expect(budget.memoryContext).toEqual([{ id: "new", messageId: "u2", source: "automatic" }]);
  });

  test("HUD data parts never inflate the estimated tool-output tokens", () => {
    expect(
      getMessageToolPartsForTokenEstimate({
        id: "a",
        role: "assistant",
        parts: [{ type: "data-context-budget", data: { huge: "x".repeat(10_000) } }],
      })
    ).toBe("");
  });
});
