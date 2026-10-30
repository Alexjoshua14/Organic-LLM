import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { emptyStageState, type StageState } from "@/lib/stage/schema";

const store = { ...(await import("@/lib/stage/store")) };
const agent = { ...(await import("@/lib/stage/agent")) };
const gate = { ...(await import("@/lib/api/plan-budget-gate")) };
const limit = { ...(await import("@/lib/rate-limit/llm")) };
let state: StageState;
const source = { id: crypto.randomUUID(), name: "Prep Planner" };
const seen = new Set<string>();
const acquire = mock(async () => ({ scope: "turn", token: "test" }));
const budget = mock(async () => null);
const rate = mock(async () => ({ success: true }));
const generate = mock(async () => ({
  reply: "This must not become another transcript message.",
  summary: "",
  designBrief: null,
  subagents: [],
  nextTier: "fast",
  view: { kind: "author", id: source.id },
  model: "test",
  usage: { inputTokens: 0, outputTokens: 0 },
}));
mock.module("@/lib/stage/store", () => ({
  ...store,
  readStage: async () => ({ state, raw: "" }),
  hasStageRequest: async (_owner: string, id: string) => seen.has(id),
  acquireStageLease: acquire,
  releaseStageLease: async () => undefined,
  mutateStage: async (
    _owner: string,
    _cause: string,
    change: (s: StageState) => StageState | null,
    options: { requestId?: string } = {}
  ) => {
    if (options.requestId && seen.has(options.requestId)) return null;
    const next = change(state);
    if (!next) return null;
    if (options.requestId) seen.add(options.requestId);
    state = { ...next, revision: state.revision + 1 };
    return state;
  },
}));
mock.module("@/lib/stage/agent", () => ({ ...agent, generateStageTurn: generate }));
mock.module("@/lib/api/plan-budget-gate", () => ({ ...gate, requirePlanBudget: budget }));
mock.module("@/lib/rate-limit/llm", () => ({ ...limit, checkLlmMessageLimit: rate }));
const { runStageTurn } = await import("@/lib/stage/turn");
afterAll(() => {
  mock.module("@/lib/stage/store", () => store);
  mock.module("@/lib/stage/agent", () => agent);
  mock.module("@/lib/api/plan-budget-gate", () => gate);
  mock.module("@/lib/rate-limit/llm", () => limit);
});
beforeEach(() => {
  seen.clear();
  acquire.mockClear();
  budget.mockClear();
  rate.mockClear();
  generate.mockClear();
  state = {
    ...emptyStageState(),
    widgets: [
      {
        id: crypto.randomUUID(),
        title: "Prep checklist",
        kind: "note",
        text: "Chop vegetables",
        rect: { x: 8, y: 4, w: 11, h: 16 },
        source,
      },
    ],
    messages: [{ id: crypto.randomUUID(), role: "assistant", text: "The plan is ready." }],
  };
});
const actor = { ownerId: "owner", clerkUserId: "clerk" };

test("a text/voice view command makes no model, budget, lease, transcript or worker changes", async () => {
  const before = state;
  const request = crypto.randomUUID();
  const result = await runStageTurn(actor, "show me the prep planner", request);
  expect(result.viewCommand).toEqual({ id: request, target: { kind: "author", id: source.id } });
  expect(result.widgets).toBe(before.widgets);
  expect(result.messages).toBe(before.messages);
  expect(result.design).toBeNull();
  expect(result.subagents).toBeUndefined();
  for (const fn of [generate, acquire, budget, rate]) expect(fn).not.toHaveBeenCalled();
  await runStageTurn(actor, "show me the prep planner", request);
  expect(state.revision).toBe(1);
});

test("less literal navigation can use Organic's view action without duplicating the result", async () => {
  const before = state;
  const result = await runStageTurn(
    actor,
    "Could we take a look at what our planner made?",
    crypto.randomUUID()
  );
  expect(generate).toHaveBeenCalledTimes(1);
  expect(result.viewCommand?.target).toEqual({ kind: "author", id: source.id });
  expect(result.messages).toBe(before.messages);
  expect(result.widgets).toBe(before.widgets);
  expect(result.design).toBeNull();
  expect(result.subagents).toBeUndefined();
});
