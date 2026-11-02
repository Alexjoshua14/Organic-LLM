import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import type { StageState } from "@/lib/stage/schema";
import { emptyStageState } from "@/lib/stage/schema";
import { assignStageSubagents } from "@/lib/stage/subagent-state";

const store = { ...(await import("@/lib/stage/store")) };
const agentModule = { ...(await import("@/lib/stage/agent")) };
let state: StageState;
let signal: AbortSignal | undefined;
let resolveDesign: (value: { plan: { operations: [] }; model: string; usage: null }) => void;
const generate = mock(async (args: { signal?: AbortSignal }) => {
  signal = args.signal;
  return new Promise((resolve) => {
    resolveDesign = resolve as typeof resolveDesign;
  });
});
mock.module("@/lib/stage/agent", () => ({ ...agentModule, generateStageDesign: generate }));
mock.module("@/lib/stage/store", () => ({
  ...store,
  acquireStageLease: async () => ({ scope: "design", token: "test" }),
  releaseStageLease: async () => undefined,
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
const { runStageDesign, cancelStageDesign } = await import("@/lib/stage/design");
afterAll(() => {
  mock.module("@/lib/stage/agent", () => agentModule);
  mock.module("@/lib/stage/store", () => store);
});
beforeEach(() => {
  generate.mockClear();
  signal = undefined;
  state = {
    ...emptyStageState(),
    design: {
      id: crypto.randomUUID(),
      status: "working",
      phase: "queued",
      brief: "Arrange a note",
      startedAt: new Date().toISOString(),
    },
  };
});

test("designer Stop aborts its model and a late plan cannot publish after cancellation", async () => {
  const id = state.design!.id;
  const running = runStageDesign({
    ownerId: "test-owner",
    clerkUserId: "test-clerk",
    jobId: id,
    base: state,
    brief: "Arrange a note",
  });
  for (let i = 0; i < 30 && !signal; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  expect(signal).toBeDefined();
  expect(state.design?.phase).toBe("working");
  await cancelStageDesign("test-owner", id);
  expect(signal!.aborted).toBe(true);
  resolveDesign({ plan: { operations: [] }, model: "fixture-model", usage: null });
  await running;
  expect(state.design).toBeNull();
});

test("designer waits when both child slots are already executing", async () => {
  state = assignStageSubagents(state, [
    { name: "First", goal: "First goal" },
    { name: "Second", goal: "Second goal" },
  ]);
  state.subagents = state.subagents!.map((agent, slot) => ({ ...agent, status: "working", slot }));
  await runStageDesign({
    ownerId: "test-owner",
    clerkUserId: "test-clerk",
    jobId: state.design!.id,
    base: state,
    brief: "Arrange",
  });
  expect(generate).not.toHaveBeenCalled();
  expect(state.design?.phase).toBe("queued");
});
