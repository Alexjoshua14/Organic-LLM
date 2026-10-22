import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { UIMessage } from "ai";

import { describe, expect, test } from "bun:test";
import { readUIMessageStream, smoothStream, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { CHAT_STREAM_CHUNKING } from "@/lib/llm/chat-stream-chunking";
import { buildChatReasoningProviderOptions } from "@/lib/schemas/chat-effort";

describe("provider reasoning stream to UI", () => {
  test("streams partial summaries before completion and preserves all summary items", async () => {
    let controller!: ReadableStreamDefaultController<LanguageModelV4StreamPart>;
    const model = new MockLanguageModelV4({
      doStream: {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(value) {
            controller = value;
          },
        }),
      },
    });
    const result = streamText({
      model,
      prompt: "Synthetic stream verification",
      providerOptions: buildChatReasoningProviderOptions("openai/gpt-6-astra", "auto"),
      experimental_transform: smoothStream({ delayInMs: null, chunking: CHAT_STREAM_CHUNKING }),
    });
    // Same default reasoning forwarding used by runLLMChatStream.
    const updates = readUIMessageStream({ stream: result.toUIMessageStream() })[
      Symbol.asyncIterator
    ]();
    controller.enqueue({ type: "stream-start", warnings: [] });
    controller.enqueue({ type: "reasoning-start", id: "summary-1" });
    controller.enqueue({ type: "reasoning-delta", id: "summary-1", delta: "First evidence " });

    let partial: UIMessage | undefined;
    while (!partial?.parts.some((part) => part.type === "reasoning" && part.text)) {
      const next = await updates.next();
      expect(next.done).not.toBe(true);
      partial = next.value;
    }
    expect(partial.parts.find((part) => part.type === "reasoning")).toMatchObject({
      type: "reasoning",
      text: "First evidence ",
      state: "streaming",
    });

    controller.enqueue({ type: "reasoning-delta", id: "summary-1", delta: "and the rest.\n" });
    controller.enqueue({ type: "reasoning-end", id: "summary-1" });
    controller.enqueue({ type: "reasoning-start", id: "summary-2" });
    controller.enqueue({
      type: "reasoning-delta",
      id: "summary-2",
      delta: "Second summary, completely preserved.",
    });
    controller.enqueue({ type: "reasoning-end", id: "summary-2" });
    controller.enqueue({ type: "text-start", id: "answer" });
    controller.enqueue({ type: "text-delta", id: "answer", delta: "The answer." });
    controller.enqueue({ type: "text-end", id: "answer" });
    controller.enqueue({ type: "reasoning-start", id: "summary-3" });
    controller.enqueue({
      type: "reasoning-delta",
      id: "summary-3",
      delta: "A later summary also survives.",
    });
    controller.enqueue({ type: "reasoning-end", id: "summary-3" });
    controller.enqueue({
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 20, text: 2, reasoning: 18 },
      },
    });
    controller.close();

    let completed = partial;
    for (;;) {
      const next = await updates.next();
      if (next.done) break;
      completed = next.value;
    }
    expect(
      completed.parts.filter((part) => part.type === "reasoning").map((part) => part.text)
    ).toEqual([
      "First evidence and the rest.\n",
      "Second summary, completely preserved.",
      "A later summary also survives.",
    ]);
    expect(completed.parts.find((part) => part.type === "text")).toMatchObject({
      type: "text",
      text: "The answer.",
      state: "done",
    });
    expect(model.doStreamCalls[0]?.providerOptions?.openai).toEqual({ reasoningSummary: "auto" });
  });
});
