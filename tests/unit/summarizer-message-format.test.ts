import { describe, expect, test } from "bun:test";
import { convertToModelMessages, type UIMessage } from "ai";

import {
  appendSummarizerTask,
  convertToolCallsToTextForSummarizer,
} from "@/lib/llm/summarizer-message-format";

describe("summarizer messages", () => {
  test("a completed exchange ends with a user task and preserves both turns", async () => {
    const transcript: UIMessage[] = [
      { id: "user", role: "user", parts: [{ type: "text", text: "What do you remember?" }] },
      { id: "assistant", role: "assistant", parts: [{ type: "text", text: "You like hiking." }] },
    ];
    const messages = await convertToModelMessages(convertToolCallsToTextForSummarizer(transcript));
    const request = appendSummarizerTask(messages, "Validate the proposed summary.");

    expect(request.slice(0, -1)).toEqual(messages);
    expect(request.at(-1)).toEqual({ role: "user", content: "Validate the proposed summary." });
    expect(messages).toHaveLength(2);
    expect(transcript[1].parts).toEqual([{ type: "text", text: "You like hiking." }]);
  });

  test("a reasoning-only interrupted reply still gets a final user task", async () => {
    const transcript: UIMessage[] = [
      { id: "user", role: "user", parts: [{ type: "text", text: "Hey" }] },
      { id: "assistant", role: "assistant", parts: [{ type: "reasoning", text: "" }] },
    ];
    const request = appendSummarizerTask(
      await convertToModelMessages(convertToolCallsToTextForSummarizer(transcript)),
      "Summarize the conversation."
    );

    expect(request.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(request.at(-1)?.content).toBe("Summarize the conversation.");
  });
});
