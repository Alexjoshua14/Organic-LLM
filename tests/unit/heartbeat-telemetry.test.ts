import { describe, expect, test } from "bun:test";

import { createHeartbeatTelemetry } from "@/lib/llm/subagents/heartbeat/telemetry";
import {
  runSubagentHeartbeat,
  type SubagentHeartbeatDeps,
} from "@/lib/llm/subagents/heartbeat/run-heartbeat";

const ownerId = "owner";
const threadId = "00000000-0000-4000-8000-000000000001";

function deps(): SubagentHeartbeatDeps & {
  evaluate: NonNullable<SubagentHeartbeatDeps["evaluate"]>;
} {
  return {
    listChildren: async () => [{ threadId, agentId: "worker", status: "done", statusAt: null }],
    loadMessages: async () => [],
    getState: async () => ({ baseline: null, digest: null, at: null }),
    claim: async () => true,
    complete: async () => {},
    enqueueReply: async () => {},
    appendSystemMessage: async () => true,
    recordUsage: () => {},
    evaluate: async () => ({
      decision: { notable: false, events: [] },
      modelId: "typesafe-ai/jev",
    }),
  };
}

async function run(overrides: Partial<ReturnType<typeof deps>> = {}) {
  let time = 0;
  const telemetry = createHeartbeatTelemetry({ ownerId, threadId, clock: () => time++ });
  const outcome = await runSubagentHeartbeat({
    ownerId,
    deps: telemetry.instrument({ ...deps(), ...overrides }),
  });
  return { outcome, row: telemetry.finish(outcome.status) };
}

describe("heartbeat telemetry", () => {
  test("records skipped polls without inventing usage or evaluations", async () => {
    const { row } = await run({ listChildren: async () => [] });
    expect(row.status).toBe("no-subagents");
    expect(row.subagent_count).toBe(0);
    expect(row.evaluation_attempted).toBe(false);
    expect(row.evaluation_duration_ms).toBeNull();
    expect(row.cost_usd).toBeNull();
    expect(row.input_tokens).toBeNull();
  });

  test("records interval and competing-claim skips", async () => {
    const recent = await run({
      getState: async () => ({ baseline: null, digest: null, at: new Date().toISOString() }),
    });
    expect(recent.row.status).toBe("too-soon");
    expect(recent.row.evaluation_attempted).toBe(false);
    const claimed = await run({ claim: async () => false });
    expect(claimed.row.status).toBe("claimed-elsewhere");
    expect(claimed.row.evaluation_attempted).toBe(false);
  });

  test("captures cost and identifiers without copying provider payloads", async () => {
    const { row } = await run({
      evaluate: async () => ({
        decision: { notable: false, events: [] },
        modelId: "typesafe-ai/jev",
        usage: {
          inputTokens: 846,
          outputTokens: 21,
          totalTokens: 867,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
        },
        providerMetadata: {
          gateway: {
            cost: "0.000035532",
            generationId: "gen_test",
            routing: { finalProvider: "typesafe-ai" },
            secret: "private-content",
          },
        },
      }),
    });
    expect(row.status).toBe("quiet");
    expect(row.evaluation_attempted).toBe(true);
    expect(row.evaluation_duration_ms).toBeGreaterThanOrEqual(0);
    expect(row.input_tokens).toBe(846);
    expect(row.cost_usd).toBe(0.000035532);
    expect(row.generation_id).toBe("gen_test");
    expect(row.provider).toBe("typesafe-ai");
    expect(JSON.stringify(row)).not.toContain("private-content");
  });

  test("captures timeout stage without exception text", async () => {
    const { row } = await run({
      evaluate: async () => {
        throw new DOMException("sensitive prompt", "TimeoutError");
      },
    });
    expect(row.status).toBe("error");
    expect(row.stage).toBe("evaluate");
    expect(row.error_code).toBe("timeout");
    expect(row.evaluation_attempted).toBe(true);
    expect(row.evaluation_duration_ms).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain("sensitive prompt");
  });

  test("preserves cost when a later operation fails", async () => {
    const { row } = await run({
      evaluate: async () => ({
        decision: { notable: false, events: [] },
        modelId: "typesafe-ai/jev",
        providerMetadata: { gateway: { cost: "0.01" } },
      }),
      complete: async () => {
        throw new Error("private database error");
      },
    });
    expect(row.stage).toBe("complete");
    expect(row.cost_usd).toBe(0.01);
    expect(row.error_code).toBe("operation-failed");
  });

  test("captures pre-evaluation failures even when the runner throws", async () => {
    const telemetry = createHeartbeatTelemetry({ ownerId, threadId });
    try {
      await runSubagentHeartbeat({
        ownerId,
        deps: telemetry.instrument({
          ...deps(),
          listChildren: async () => {
            throw new Error("private");
          },
        }),
      });
    } catch {}
    const row = telemetry.finish("error");
    expect(row.stage).toBe("list-children");
    expect(row.evaluation_attempted).toBe(false);
    expect(row.error_code).toBe("operation-failed");
  });

  test("records budget and target rejection without model calls", async () => {
    const telemetry = createHeartbeatTelemetry({ ownerId, threadId });
    await telemetry.measure("budget", async () => false);
    expect(telemetry.finish("blocked-budget").stage).toBe("budget");
    await telemetry.measure("target", async () => true);
    expect(telemetry.finish("invalid-target").stage).toBe("target");
    expect(telemetry.finish("invalid-target").evaluation_attempted).toBe(false);
  });

  test("counts notable events without storing snapshots", async () => {
    const snapshot = {
      threadId,
      agentId: "worker",
      name: "Worker",
      role: "research",
      status: "done" as const,
      statusAt: null,
      lastMessageId: null,
      lastGoal: "private-goal",
      lastOutcome: "private-outcome",
    };
    const { row } = await run({
      evaluate: async () => ({
        decision: {
          notable: true,
          events: [
            {
              threadId,
              agentId: "worker",
              name: "Worker",
              role: "research",
              previous: null,
              current: snapshot,
            },
          ],
        },
        modelId: "typesafe-ai/jev",
      }),
    });
    expect(row.status).toBe("notable");
    expect(row.event_count).toBe(1);
    expect(JSON.stringify(row)).not.toContain("private-goal");
    expect(JSON.stringify(row)).not.toContain("private-outcome");
  });
});
