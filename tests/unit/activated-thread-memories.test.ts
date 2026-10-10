import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import { getMessageTextForTokenEstimate, getMessageToolPartsForTokenEstimate } from "@/lib/chat/context-budget";
import {
  ACTIVATED_MEMORIES_PART_TYPE,
  attachActivatedMemoriesToLatestUserMessage,
  clipMemoryText,
  expandActivatedMemoriesForModel,
  formatActivatedMemoriesBlock,
  readActivatedMemories,
  toActivatedMemories,
  withActivatedMemories,
} from "@/lib/memory/activated-thread-memories";

function userMessage(id: string, text: string, extraParts: UIMessage["parts"] = []): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }, ...extraParts],
  };
}

describe("toActivatedMemories", () => {
  test("drops blanks, dedupes by id, and clips long text", () => {
    const memories = toActivatedMemories([
      { id: "a", memory: "  Prefers  Neo4j  " },
      { id: "a", memory: "duplicate" },
      { id: "", memory: "   " },
      { memory: "No id fact" },
      { id: "long", memory: "x".repeat(600) },
    ]);

    expect(memories.map((memory) => memory.id)).toEqual(["a", "text:no id fact", "long"]);
    expect(memories[0]?.text).toBe("Prefers Neo4j");
    expect(memories[2]?.text.endsWith("…")).toBe(true);
    expect(memories[2]?.text.length).toBe(500);
  });

  test("keeps full text when clip is off, and clips again when written to a message", () => {
    const [memory] = toActivatedMemories([{ id: "long", memory: "x".repeat(600) }], { clip: false });

    expect(memory?.text.length).toBe(600);

    const stamped = withActivatedMemories(userMessage("u1", "hi"), [memory!]);

    expect(readActivatedMemories(stamped)[0]?.text.length).toBe(500);
  });
});

describe("clipMemoryText", () => {
  test("ends on a sentence boundary near the cap", () => {
    const text = `${"a".repeat(70)}. ${"b".repeat(40)}`;
    const clipped = clipMemoryText(text, 100);

    expect(clipped).toBe(`${"a".repeat(70)}.…`);
    expect(clipped.length).toBeLessThanOrEqual(100);
  });

  test("falls back to a word boundary, then a hard cut", () => {
    const words = Array.from({ length: 30 }, () => "word").join(" ");
    const byWord = clipMemoryText(words, 50);

    expect(byWord.endsWith("word…")).toBe(true);
    expect(byWord.length).toBeLessThanOrEqual(50);
    expect(clipMemoryText("y".repeat(80), 50)).toBe(`${"y".repeat(49)}…`);
  });

  test("leaves text within the cap alone", () => {
    expect(clipMemoryText("short", 50)).toBe("short");
  });
});

describe("activated memories on user messages", () => {
  test("stores a hidden part and leaves the visible text unchanged", () => {
    const original = userMessage("m1", "How's the graph store?");
    const stamped = withActivatedMemories(original, [{ id: "mem-1", text: "Graph store: Neo4j." }]);

    expect(original.parts).toHaveLength(1);
    expect(stamped.parts.filter((part) => part.type === "text")).toEqual(original.parts);
    expect(readActivatedMemories(stamped)).toEqual([{ id: "mem-1", text: "Graph store: Neo4j." }]);
    expect(stamped.parts.some((part) => part.type === ACTIVATED_MEMORIES_PART_TYPE)).toBe(true);
  });

  test("stamps only the latest user message", () => {
    const messages = [
      userMessage("u1", "earlier"),
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "ok" }] } as UIMessage,
      userMessage("u2", "now"),
    ];
    const stamped = attachActivatedMemoriesToLatestUserMessage(messages, [
      { id: "mem-1", text: "Graph store: Neo4j." },
    ]);

    expect(readActivatedMemories(stamped[0]!)).toEqual([]);
    expect(readActivatedMemories(stamped[2]!).map((memory) => memory.id)).toEqual(["mem-1"]);
  });

  test("expands each memory once, on the latest message that carries it", () => {
    const older = withActivatedMemories(userMessage("u1", "turn one"), [
      { id: "mem-1", text: "Graph store: Neo4j." },
      { id: "mem-2", text: "User wants local infrastructure." },
    ]);
    const newer = withActivatedMemories(userMessage("u2", "turn two"), [
      { id: "mem-1", text: "Graph store: Neo4j." },
      { id: "mem-3", text: "Current project is Organic LLM." },
    ]);

    const expanded = expandActivatedMemoriesForModel([older, newer]);
    const olderText = expanded[0]!.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const newerText = expanded[1]!.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n");

    expect(olderText).toContain("User wants local infrastructure.");
    expect(olderText).not.toContain("Graph store: Neo4j.");
    expect(newerText).toContain("Graph store: Neo4j.");
    expect(newerText).toContain("Current project is Organic LLM.");
    expect(older.parts.filter((part) => part.type === "text")).toHaveLength(1);
  });
});

describe("activated memory token estimate", () => {
  test("counts the memory block as message text and not as a tool part", () => {
    const message = withActivatedMemories(userMessage("u1", "hello"), [
      { id: "mem-1", text: "Graph store: Neo4j." },
    ]);
    const estimate = getMessageTextForTokenEstimate(message);

    expect(estimate).toContain("hello");
    expect(estimate).toContain(formatActivatedMemoriesBlock(readActivatedMemories(message)));
    expect(getMessageToolPartsForTokenEstimate(message)).toBe("");
  });
});
