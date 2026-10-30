import { afterAll, beforeEach, expect, mock, test } from "bun:test";

import type { StageState } from "@/lib/stage/schema";
import { emptyStageState } from "@/lib/stage/schema";
import { assignStageSubagents } from "@/lib/stage/subagent-state";

const ai = { ...(await import("ai")) };
const store = { ...(await import("@/lib/stage/store")) };
const redis = { ...(await import("@/lib/redis/redis")) };
let state: StageState;
let signal: AbortSignal | undefined;
let resolveModel: (value: { text: string }) => void;
const generate = mock(async (options: { abortSignal: AbortSignal }) => {
  signal = options.abortSignal;
  // Deliberately ignore AbortSignal until resolved: the worker must also fence late success.
  return new Promise<{ text: string }>((resolve) => {
    resolveModel = resolve;
  });
});
const leases = new Map<string, string>();
mock.module("ai", () => ({ ...ai, generateText: generate }));
mock.module("@/lib/redis/redis", () => ({
  ...redis,
  redis: {
    ...redis.redis,
    set: async (key: string, value: string) => {
      if (leases.has(key)) return null;
      leases.set(key, value);
      return "OK";
    },
    eval: async (_script: string, keys: string[]) => {
      leases.delete(keys[0]);
      return 1;
    },
  },
}));
mock.module("@/lib/stage/store", () => ({
  ...store,
  readStage: async () => ({ state, raw: "" }),
  mutateStage: async (
    _owner: string,
    _cause: string,
    change: (current: StageState) => StageState | null
  ) => {
    const next = change(state);
    if (next) state = { ...next, revision: state.revision + 1 };
    return next ? state : null;
  },
}));
const { runStageSubagent, cancelStageSubagent } = await import("@/lib/stage/subagents");

afterAll(() => {
  mock.module("ai", () => ai);
  mock.module("@/lib/redis/redis", () => redis);
  mock.module("@/lib/stage/store", () => store);
});
beforeEach(() => {
  signal = undefined;
  generate.mockClear();
  leases.clear();
  state = assignStageSubagents(emptyStageState(), [
    { name: "Planner", goal: "Compare two approaches" },
  ]);
});

async function untilRunning() {
  for (let i = 0; i < 30 && !signal; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  expect(signal).toBeDefined();
}

test("Stop aborts the active model and fences a response arriving after cancellation", async () => {
  const job = state.subagents![0];
  const running = runStageSubagent({ ownerId: "test-owner", clerkUserId: "test-clerk" }, job);
  await untilRunning();
  await cancelStageSubagent("test-owner", job.id);
  expect(signal!.aborted).toBe(true);
  resolveModel({ text: "This late result must never be published" });
  await running;
  expect(state.subagents![0].status).toBe("canceled");
  expect(state.subagents![0].result).toBeNull();
  expect(state.messages.some((message) => message.text.includes("late result"))).toBe(false);
});

test("duplicate after callbacks cannot run a worker twice", async () => {
  const job = state.subagents![0];
  const first = runStageSubagent({ ownerId: "test-owner", clerkUserId: "test-clerk" }, job);
  await untilRunning();
  await runStageSubagent({ ownerId: "test-owner", clerkUserId: "test-clerk" }, job);
  expect(generate).toHaveBeenCalledTimes(1);
  resolveModel({ text: "The work is complete." });
  await first;
  expect(state.subagents![0].status).toBe("done");
  expect(state.messages.at(-1)?.text).toContain("work is complete");
});
