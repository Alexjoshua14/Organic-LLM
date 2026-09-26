import { describe, expect, test } from "bun:test";

import {
  formatSendTargetLabel,
  resolveArcadiaMultitaskLayoutMode,
} from "@/lib/arcadia/multitask/layout-mode";
import {
  queueAgentIdFromSendTarget,
  sendTargetFromQueueAgentId,
} from "@/lib/schemas/arcadia-multitask-send-target";

describe("resolveArcadiaMultitaskLayoutMode", () => {
  test("stays overlay when every agent is idle or done", () => {
    expect(
      resolveArcadiaMultitaskLayoutMode([
        { status: "idle" },
        { status: "done" },
      ])
    ).toBe("overlay");
  });

  test("switches to dashboard when any agent is working", () => {
    expect(
      resolveArcadiaMultitaskLayoutMode([
        { status: "idle" },
        { status: "working" },
      ])
    ).toBe("dashboard");
  });

  test("treats blocked as running for the dashboard", () => {
    expect(resolveArcadiaMultitaskLayoutMode([{ status: "blocked" }])).toBe("dashboard");
  });

  test("empty roster stays overlay", () => {
    expect(resolveArcadiaMultitaskLayoutMode([])).toBe("overlay");
  });
});

describe("formatSendTargetLabel", () => {
  test("labels orchestrator and named subagents", () => {
    const agents = [{ id: "agent-coder", name: "Reed" }];

    expect(formatSendTargetLabel({ kind: "orchestrator" }, agents)).toBe("Orchestrator");
    expect(formatSendTargetLabel({ kind: "subagent", agentId: "agent-coder" }, agents)).toBe(
      "Reed"
    );
    expect(formatSendTargetLabel({ kind: "subagent", agentId: "missing" }, agents)).toBe(
      "Subagent"
    );
  });
});

describe("queueAgentIdFromSendTarget", () => {
  test("omits agent id for orchestrator so queue rows target the main thread", () => {
    expect(queueAgentIdFromSendTarget({ kind: "orchestrator" })).toBeUndefined();
    expect(queueAgentIdFromSendTarget(null)).toBeUndefined();
  });

  test("maps subagent send target to queueTargetAgentId", () => {
    expect(queueAgentIdFromSendTarget({ kind: "subagent", agentId: "agent-coder" })).toBe(
      "agent-coder"
    );
  });

  test("round-trips with sendTargetFromQueueAgentId", () => {
    expect(sendTargetFromQueueAgentId(undefined)).toEqual({ kind: "orchestrator" });
    expect(sendTargetFromQueueAgentId("agent-writer")).toEqual({
      kind: "subagent",
      agentId: "agent-writer",
    });
    expect(queueAgentIdFromSendTarget(sendTargetFromQueueAgentId("agent-planner"))).toBe(
      "agent-planner"
    );
  });
});
