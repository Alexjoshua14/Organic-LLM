import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { UIMessage } from "ai";

import { describe, expect, test } from "bun:test";
import { isStepCount, readUIMessageStream, smoothStream, streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import {
  createActivityTrailTimer,
  groupActivityTrails,
  readTrailDuration,
} from "@/lib/chat/activity-trail";
import { trailSummaryLabel } from "@/lib/chat/activity-trail-summary";

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

  test("server trail timing lines up with client trails and is saved on the message", async () => {
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 2, text: 1, reasoning: 1 },
    };
    const steps: LanguageModelV4StreamPart[][] = [
      [
        { type: "stream-start", warnings: [] },
        { type: "reasoning-start", id: "r1" },
        { type: "reasoning-delta", id: "r1", delta: "**Checking the changelog**" },
        { type: "reasoning-end", id: "r1" },
        // A tool call with no tool-input-start still joins the trail.
        {
          type: "tool-call",
          toolCallId: "s1",
          toolName: "web_search",
          input: JSON.stringify({ query: "vercel" }),
        },
        { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
      ],
      [
        { type: "stream-start", warnings: [] },
        // Empty reasoning (provider withheld text) is still part of the trail.
        { type: "reasoning-start", id: "r2" },
        { type: "reasoning-end", id: "r2" },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: "  " },
        { type: "text-delta", id: "t1", delta: "Answer." },
        { type: "text-end", id: "t1" },
        { type: "reasoning-start", id: "r3" },
        { type: "reasoning-delta", id: "r3", delta: "Afterthought." },
        { type: "reasoning-end", id: "r3" },
        { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
      ],
    ];
    let call = 0;
    const model = new MockLanguageModelV4({
      doStream: async () => {
        const parts = steps[call++];

        return {
          stream: new ReadableStream<LanguageModelV4StreamPart>({
            start(controller) {
              parts.forEach((part) => controller.enqueue(part));
              controller.close();
            },
          }),
        };
      },
    });
    let clock = 0;
    const result = streamText({
      model,
      prompt: "Synthetic trail timing",
      stopWhen: isStepCount(2),
      tools: {
        web_search: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async () => {
            clock += 5_000;

            return { results: [{ url: "https://a.example" }, { url: "https://b.example" }] };
          },
        }),
      },
    });
    const observe = createActivityTrailTimer(() => (clock += 1_000));
    let saved: UIMessage | undefined;
    const stream = result.toUIMessageStream({
      messageMetadata: ({ part }) => observe(part),
      onEnd: ({ responseMessage }) => {
        saved = responseMessage;
      },
    });

    let completed: UIMessage | undefined;

    for await (const message of readUIMessageStream({ stream })) completed = message;

    const message = completed!;
    const trails = [...groupActivityTrails(message.parts).trailsByStartIndex.values()];

    expect(trails.map((trail) => trail.steps.map((step) => step.kind))).toEqual([
      ["reasoning", "tool", "reasoning"],
      ["reasoning"],
    ]);
    const first = readTrailDuration(message, 0);
    const second = readTrailDuration(message, 1);

    expect(first).toBeGreaterThan(5_000);
    expect(second).toBeGreaterThan(0);
    expect(second!).toBeLessThan(first!);
    expect(trailSummaryLabel(message.parts, trails[0], first)).toMatch(
      /^Thought for \d+s · searched 2 sources$/
    );
    expect(saved?.metadata).toEqual(message.metadata);
  });
});
