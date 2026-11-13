import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { emptyStageState, type StageState } from "@/lib/stage/schema";

const store = { ...(await import("@/lib/stage/store")) };
const agent = { ...(await import("@/lib/stage/agent")) };
const gate = { ...(await import("@/lib/api/plan-budget-gate")) };
const limit = { ...(await import("@/lib/rate-limit/llm")) };
const memory = { ...(await import("@/lib/stage/memory")) };
const nextServer = { ...(await import("next/server")) };
const recall = mock(async () => [{ text: "Stage should feel like a second brain", at: null }]);
const remember = mock(async () => undefined);
const deferred: (() => unknown)[] = [];
let state: StageState;
const source = { id: crypto.randomUUID(), name: "Prep Planner" };
const seen = new Set<string>();
const acquire = mock(async () => ({ scope: "turn", token: "test" }));
const budget = mock(async () => null);
const rate = mock(async () => ({ success: true }));
const generate = mock(
  async (): Promise<Record<string, unknown>> => ({
    reply: "This must not become another transcript message.",
    summary: "",
    designBrief: null,
    subagents: [],
    nextTier: "fast",
    view: { kind: "author", id: source.id },
    captures: [],
    recall: null,
    model: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
  })
);
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
mock.module("@/lib/stage/memory", () => ({
  ...memory,
  recallStageMemories: recall,
  rememberStageCaptures: remember,
}));
mock.module("next/server", () => ({
  ...nextServer,
  after: (task: () => unknown) => void deferred.push(task),
}));
const { runStageTurn } = await import("@/lib/stage/turn");
afterAll(() => {
  mock.module("@/lib/stage/store", () => store);
  mock.module("@/lib/stage/agent", () => agent);
  mock.module("@/lib/api/plan-budget-gate", () => gate);
  mock.module("@/lib/rate-limit/llm", () => limit);
  mock.module("@/lib/stage/memory", () => memory);
  mock.module("next/server", () => nextServer);
});
beforeEach(() => {
  seen.clear();
  acquire.mockClear();
  budget.mockClear();
  rate.mockClear();
  generate.mockClear();
  recall.mockClear();
  remember.mockClear();
  deferred.length = 0;
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

test("captured thoughts are filed and remembered even when the turn also switches views", async () => {
  generate.mockImplementationOnce(async () => ({
    reply: "Filed under Ideas.",
    summary: "",
    designBrief: null,
    subagents: [],
    nextTier: "fast",
    view: { kind: "author", id: source.id },
    captures: [{ collectionId: null, collection: "Ideas", text: "Stage is the thinking surface" }],
    recall: "second brain",
    model: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
  }));
  const result = await runStageTurn(actor, "Stage should be where I think", crypto.randomUUID());
  const collection = result.widgets.find((widget) => widget.kind === "collection");
  expect(collection).toMatchObject({
    title: "Ideas",
    items: [{ text: "Stage is the thinking surface" }],
  });
  expect(result.widgets.find((widget) => widget.kind === "recall")).toMatchObject({
    query: "second brain",
    items: [{ text: "Stage should feel like a second brain" }],
  });
  expect(result.messages.at(-1)?.text).toBe("Filed under Ideas.");
  expect(result.viewCommand?.target).toEqual({ kind: "author", id: source.id });
  for (const task of deferred) await task();
  expect(remember).toHaveBeenCalledTimes(1);
});

test("memory switched off files to the stage without recall or long-term writes", async () => {
  generate.mockImplementationOnce(async () => ({
    reply: "Noted.",
    summary: "",
    designBrief: null,
    subagents: [],
    nextTier: "fast",
    view: null,
    captures: [{ collectionId: null, collection: "Ideas", text: "Keep this private" }],
    recall: "anything",
    model: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
  }));
  const result = await runStageTurn(actor, "Keep this private", crypto.randomUUID(), {
    memory: false,
  });
  expect(result.widgets.some((widget) => widget.kind === "collection")).toBe(true);
  expect(result.widgets.some((widget) => widget.kind === "recall")).toBe(false);
  expect(recall).not.toHaveBeenCalled();
  expect(deferred).toHaveLength(0);
});
