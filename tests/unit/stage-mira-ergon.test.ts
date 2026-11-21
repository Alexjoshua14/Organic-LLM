import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { StageState } from "@/lib/stage/schema";
import { emptyStageState, isStageMiraSubagent, STAGE_MIRA_AGENT_ID } from "@/lib/stage/schema";
import { assignStageSubagents } from "@/lib/stage/subagent-state";
import {
  ERGON_TEST_OWNER,
  installConnectedErgon,
  uninstallConnectedErgon,
} from "../helpers/ergon-connected";

describe("Stage Mira assignment", () => {
  test("detects Mira by agentId or name and normalizes on assign", () => {
    expect(isStageMiraSubagent({ name: "Researcher" })).toBe(false);
    expect(isStageMiraSubagent({ name: "Mira", agentId: STAGE_MIRA_AGENT_ID })).toBe(true);
    expect(isStageMiraSubagent({ name: "mira" })).toBe(true);

    const byId = assignStageSubagents(emptyStageState(), [
      { name: "Planner", agentId: STAGE_MIRA_AGENT_ID, goal: "Brief COA-1" },
    ]);
    expect(byId.subagents![0]).toMatchObject({
      name: "Mira",
      agentId: STAGE_MIRA_AGENT_ID,
      webSearch: false,
      goal: "Brief COA-1",
    });

    const byName = assignStageSubagents(emptyStageState(), [
      { name: "Mira", goal: "List open questions" },
    ]);
    expect(byName.subagents![0]).toMatchObject({
      name: "Mira",
      agentId: STAGE_MIRA_AGENT_ID,
    });
  });

  test("keeps ordinary workers free of Mira agentId", () => {
    const state = assignStageSubagents(
      emptyStageState(),
      [{ name: "Researcher", goal: "Compare options" }],
      { memory: true, webSearch: true }
    );

    expect(state.subagents![0]).toMatchObject({
      name: "Researcher",
      memory: true,
      webSearch: true,
    });
    expect(state.subagents![0].agentId).toBeUndefined();
    expect(isStageMiraSubagent(state.subagents![0])).toBe(false);
  });
});

const ai = { ...(await import("ai")) };
const store = { ...(await import("@/lib/stage/store")) };
const redis = { ...(await import("@/lib/redis/redis")) };
const ergonTools = { ...(await import("@/lib/llm/ergon-agent-tools")) };
let state: StageState;
let lastTools: Record<string, unknown> | undefined;
let lastInstructions: string | undefined;
const generate = mock(
  async (options: { tools?: Record<string, unknown>; instructions?: string }) => {
    lastTools = options.tools;
    lastInstructions = options.instructions;
    return {
      text: "Brief ready.",
      output: { reply: "Brief ready.", pieces: [] },
      usage: { inputTokens: 1, outputTokens: 1 },
      totalUsage: { inputTokens: 1, outputTokens: 1 },
    };
  }
);
const leases = new Map<string, string>();
const createErgon = mock(async (ownerId: string) => {
  if (ownerId !== ERGON_TEST_OWNER) return {};
  return { ergon_get_issue_brief: { description: "brief" } };
});

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
mock.module("@/lib/llm/ergon-agent-tools", () => ({
  ...ergonTools,
  createErgonAgentTools: createErgon,
}));

const { runStageSubagent } = await import("@/lib/stage/subagents");

afterAll(() => {
  mock.module("ai", () => ai);
  mock.module("@/lib/redis/redis", () => redis);
  mock.module("@/lib/stage/store", () => store);
  mock.module("@/lib/llm/ergon-agent-tools", () => ergonTools);
});

describe("Stage Mira Ergon runtime", () => {
  beforeEach(async () => {
    await installConnectedErgon();
    lastTools = undefined;
    lastInstructions = undefined;
    generate.mockClear();
    createErgon.mockClear();
    leases.clear();
    state = emptyStageState();
  });
  afterEach(uninstallConnectedErgon);

  test("Mira worker mounts Ergon tools and Mira instructions when connected", async () => {
    state = assignStageSubagents(state, [
      { name: "Mira", agentId: STAGE_MIRA_AGENT_ID, goal: "Brief COA-675" },
    ]);
    const job = state.subagents![0];

    await runStageSubagent({ ownerId: ERGON_TEST_OWNER, clerkUserId: "clerk" }, job);

    expect(createErgon).toHaveBeenCalledWith(ERGON_TEST_OWNER);
    expect(generate).toHaveBeenCalled();
    expect(lastTools).toHaveProperty("ergon_get_issue_brief");
    expect(lastInstructions).toContain("You are Mira");
    expect(lastInstructions).toContain("Ergon is the owner's planning");
    expect(state.subagents![0].status).toBe("done");
    expect(state.messages.at(-1)?.text).toContain("Brief ready");
  });

  test("Mira settles with a connect prompt when Ergon tools are unavailable", async () => {
    state = assignStageSubagents(state, [
      { name: "Mira", agentId: STAGE_MIRA_AGENT_ID, goal: "Brief COA-675" },
    ]);
    const job = state.subagents![0];

    await runStageSubagent({ ownerId: "someone-else", clerkUserId: "clerk" }, job);

    expect(generate).not.toHaveBeenCalled();
    expect(state.subagents![0].status).toBe("done");
    expect(state.messages.at(-1)?.text).toContain("Connect it in Settings");
  });

  test("generic workers never request Ergon tools", async () => {
    state = assignStageSubagents(state, [{ name: "Researcher", goal: "Outline options" }]);
    const job = state.subagents![0];

    await runStageSubagent({ ownerId: ERGON_TEST_OWNER, clerkUserId: "clerk" }, job);

    expect(createErgon).not.toHaveBeenCalled();
    expect(lastTools).not.toHaveProperty("ergon_get_issue_brief");
    expect(state.subagents![0].status).toBe("done");
  });
});
