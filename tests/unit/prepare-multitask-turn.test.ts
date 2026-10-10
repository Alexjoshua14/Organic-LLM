import { describe, expect, mock, test } from "bun:test";

import {
  prepareArcadiaMultitaskTurn,
  type MultitaskTurnDeps,
  type PrepareMultitaskTurnInput,
} from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";
import { createHeuristicThoughtRouter } from "@/lib/llm/subagents/orchestrator/thought-router";

const CHAT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function setup() {
  const router = createHeuristicThoughtRouter();
  const deps = {
    getLink: mock<MultitaskTurnDeps["getLink"]>(async () => null),
    isMultitaskEnabled: mock(async () => false),
    listChildren: mock<MultitaskTurnDeps["listChildren"]>(async () => []),
    ensureChild: mock(async () => CHILD_ID),
    loadMessages: mock(async () => []),
    appendMessages: mock(async () => true),
    setStatus: mock(async () => {}),
    recordUsage: mock(() => {}),
    enqueueWorker: mock(async () => {}),
    router: { route: mock(router.route) },
  } satisfies MultitaskTurnDeps;
  const writer = { write: mock(() => {}) };
  const input: PrepareMultitaskTurnInput = {
    chatId: CHAT_ID,
    ownerId: "owner",
    userText: "Have Reed implement the cache invalidation path.",
    modelId: "test-model",
    zeroDataRetention: true,
    deps,
    writer,
  };

  return { deps, writer, input };
}

function expectNoDelegation({ deps, writer }: ReturnType<typeof setup>) {
  expect(deps.router.route).not.toHaveBeenCalled();
  expect(deps.listChildren).not.toHaveBeenCalled();
  expect(deps.loadMessages).not.toHaveBeenCalled();
  expect(deps.ensureChild).not.toHaveBeenCalled();
  expect(deps.appendMessages).not.toHaveBeenCalled();
  expect(deps.setStatus).not.toHaveBeenCalled();
  expect(deps.enqueueWorker).not.toHaveBeenCalled();
  expect(writer.write).not.toHaveBeenCalled();
}

describe("Arcadia multitask delegation gate", () => {
  test("mode off keeps a routable task in the normal chat", async () => {
    const state = setup();

    expect(await prepareArcadiaMultitaskTurn(state.input)).toBeNull();
    expect(state.deps.isMultitaskEnabled).toHaveBeenCalledWith(CHAT_ID);
    expectNoDelegation(state);
  });

  test("existing workers and an explicit target cannot enable delegation while mode is off", async () => {
    for (const sendTarget of [
      { kind: "orchestrator" as const },
      { kind: "subagent" as const, agentId: "agent-coder" },
    ]) {
      const state = setup();
      state.deps.listChildren.mockResolvedValue([
        { threadId: CHILD_ID, agentId: "agent-coder", status: "working", statusAt: null },
      ]);

      expect(await prepareArcadiaMultitaskTurn({ ...state.input, sendTarget })).toBeNull();
      expectNoDelegation(state);
    }
  });

  test("mode on persists and queues the worker assignment", async () => {
    const { deps, input, writer } = setup();
    deps.isMultitaskEnabled.mockResolvedValue(true);

    const result = await prepareArcadiaMultitaskTurn(input);

    expect(result?.role).toBe("orchestrator");
    expect(result?.hasSubagentThreads).toBe(true);
    expect(deps.router.route).toHaveBeenCalledTimes(1);
    expect(deps.appendMessages).toHaveBeenCalledTimes(1);
    expect(deps.setStatus).toHaveBeenCalledWith(CHILD_ID, "working");
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(1);
    expect(writer.write).toHaveBeenCalledTimes(1);
  });

  test("turning mode off stops new assignments on the next turn", async () => {
    const { deps, input } = setup();
    deps.isMultitaskEnabled.mockResolvedValue(true);
    await prepareArcadiaMultitaskTurn(input);
    deps.isMultitaskEnabled.mockResolvedValue(false);

    expect(await prepareArcadiaMultitaskTurn(input)).toBeNull();
    expect(deps.router.route).toHaveBeenCalledTimes(1);
    expect(deps.enqueueWorker).toHaveBeenCalledTimes(1);
  });

  test("unavailable mode state keeps the request in the normal chat", async () => {
    const state = setup();
    state.deps.isMultitaskEnabled.mockRejectedValue(new Error("Mode state unavailable"));

    expect(await prepareArcadiaMultitaskTurn(state.input)).toBeNull();
    expectNoDelegation(state);
  });

  test("talking in a subagent's own thread preserves its identity without delegating", async () => {
    const state = setup();
    state.deps.getLink.mockResolvedValue({
      threadId: CHILD_ID,
      parentThreadId: CHAT_ID,
      agentId: "agent-coder",
    });

    const result = await prepareArcadiaMultitaskTurn({ ...state.input, chatId: CHILD_ID });

    expect(result?.role).toBe("subagent");
    expect(result?.systemFragments.join("\n")).toContain("Reed");
    expect(state.deps.isMultitaskEnabled).not.toHaveBeenCalled();
    expectNoDelegation(state);
  });
});
