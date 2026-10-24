import { expect, test } from "bun:test";

// prepare-input → compile-chat-tools → orchestrator-tools → prepare-input is a cycle; a queued
// worker run loads the worker module first, so orchestrator-tools must not read prepare-input
// bindings at module load.
test("the worker module loads before the chat tool compiler", async () => {
  const worker = await import("@/lib/llm/subagents/worker/run-in-thread");

  expect(worker.SUBAGENT_THREAD_CONTEXT_MESSAGES).toBe(30);
});
