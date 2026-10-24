import { describe, expect, test } from "bun:test";
import { smoothStream, type TextStreamPart, type ToolSet } from "ai";

import { CHAT_STREAM_CHUNKING } from "@/lib/llm/chat-stream-chunking";

async function smooth(chunks: TextStreamPart<ToolSet>[]) {
  const source = new ReadableStream<TextStreamPart<ToolSet>>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const stream = source.pipeThrough(
    smoothStream({ delayInMs: null, chunking: CHAT_STREAM_CHUNKING })({ tools: {} })
  );
  const result: TextStreamPart<ToolSet>[] = [];

  for await (const chunk of stream) result.push(chunk);

  return result;
}

describe("chat stream chunking", () => {
  test("reasoning completes and the answer follows, including empty deltas", async () => {
    const result = await smooth([
      { type: "reasoning-start", id: "reasoning" },
      { type: "reasoning-delta", id: "reasoning", text: "" },
      { type: "reasoning-delta", id: "reasoning", text: "Let me check.\n" },
      { type: "reasoning-delta", id: "reasoning", text: "\nI remember this." },
      { type: "reasoning-end", id: "reasoning" },
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", text: "Here's what I know." },
      { type: "text-end", id: "answer" },
    ]);

    expect(
      result
        .filter((chunk) => chunk.type === "reasoning-delta")
        .map((chunk) => chunk.text)
        .join("")
    ).toBe("Let me check.\n\nI remember this.");
    expect(
      result
        .filter((chunk) => chunk.type === "text-delta")
        .map((chunk) => chunk.text)
        .join("")
    ).toBe("Here's what I know.");
    expect(result.at(-1)).toEqual({ type: "text-end", id: "answer" });
  });

  test("preserves Markdown, blank lines and text split across provider deltas", async () => {
    const deltas = [
      "# Heading\n\n",
      "Some ",
      "text.\n",
      "```ts\nconst n = 1;\n```\n\n",
      "Final line",
    ];
    const result = await smooth([
      { type: "text-start", id: "answer" },
      ...deltas.map((text) => ({ type: "text-delta" as const, id: "answer", text })),
      { type: "text-end", id: "answer" },
    ]);

    expect(
      result
        .filter((chunk) => chunk.type === "text-delta")
        .map((chunk) => chunk.text)
        .join("")
    ).toBe(deltas.join(""));
    expect(
      result.filter((chunk) => chunk.type === "text-delta").every((chunk) => chunk.text.length > 0)
    ).toBe(true);
  });

  test("preserves metadata boundaries and non-text events", async () => {
    const metadata = { anthropic: { signature: "test-signature" } };
    const chunks: TextStreamPart<ToolSet>[] = [
      { type: "reasoning-start", id: "reasoning" },
      { type: "reasoning-delta", id: "reasoning", text: "Thinking", providerMetadata: metadata },
      { type: "reasoning-delta", id: "reasoning", text: "", providerMetadata: metadata },
      { type: "reasoning-end", id: "reasoning" },
      {
        type: "tool-call",
        toolCallId: "call",
        toolName: "search_memories",
        input: { query: "em" },
      },
    ];

    expect(await smooth(chunks)).toEqual(chunks);
  });
});
