import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useVisibleSubagents } from "@/app/sandbox/arcadia/_components/use-visible-subagents";
import {
  isSubagentVisible,
  MULTITASK_RECENT_ACTIVITY_MS,
} from "@/lib/arcadia/multitask/agent-visibility";
import { mergeSubagentBoard, type SubagentBoardEntry } from "@/lib/arcadia/multitask/board-sync";
import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";

const now = 1_800_000_000_000;
const agent = createDemoSubagents()[0]!;

afterEach(cleanup);

describe("multiagent activity visibility", () => {
  test("hides unused slots and stale results while retaining work and blocked agents", () => {
    expect(isSubagentVisible({ ...agent, status: "idle" }, now)).toBe(false);
    expect(isSubagentVisible({ ...agent, status: "done", statusAt: now - 60_000 }, now)).toBe(
      false
    );
    expect(isSubagentVisible({ ...agent, status: "working" }, now)).toBe(true);
    expect(isSubagentVisible({ ...agent, status: "blocked" }, now)).toBe(true);
    expect(isSubagentVisible({ ...agent, status: "idle" }, now, [agent.id])).toBe(true);
  });

  test("server completion time survives repeated polling without renewing the grace period", () => {
    const entry: SubagentBoardEntry = {
      agentId: agent.id,
      threadId: "child",
      name: agent.name,
      role: agent.role,
      status: "done",
      statusAt: new Date(now).toISOString(),
      goal: "Review",
      outcome: "Reviewed.",
    };
    const [completed] = mergeSubagentBoard([agent], [entry], now);
    const [polled] = mergeSubagentBoard([completed!], [entry], now + 20_000);
    expect(isSubagentVisible(polled!, now + MULTITASK_RECENT_ACTIVITY_MS - 1)).toBe(true);
    expect(isSubagentVisible(polled!, now + MULTITASK_RECENT_ACTIVITY_MS)).toBe(false);
    expect(mergeSubagentBoard([agent], [entry], now + 60_000)[0]!.statusAt).toBe(now);
  });

  test("expires without another poll and cleans up its timer", () => {
    const clock = spyOn(Date, "now").mockReturnValue(now);
    let expire: (() => void) | undefined;
    const timer = spyOn(window, "setTimeout").mockImplementation((callback) => {
      expire = callback as () => void;
      return 123;
    });
    const clear = spyOn(window, "clearTimeout");
    try {
      const completed = { ...agent, status: "done" as const, statusAt: now };
      const hook = renderHook(({ agents }) => useVisibleSubagents(agents, []), {
        initialProps: { agents: [completed] },
      });
      expect(hook.result.current).toHaveLength(1);
      expect(timer).toHaveBeenCalledWith(expect.any(Function), MULTITASK_RECENT_ACTIVITY_MS);
      clock.mockReturnValue(now + MULTITASK_RECENT_ACTIVITY_MS);
      act(() => expire!());
      expect(hook.result.current).toHaveLength(0);
      hook.rerender({ agents: [{ ...completed, statusAt: now + MULTITASK_RECENT_ACTIVITY_MS }] });
      expect(hook.result.current).toHaveLength(1);
      hook.unmount();
      expect(clear).toHaveBeenCalledWith(123);
    } finally {
      clock.mockRestore();
      timer.mockRestore();
      clear.mockRestore();
    }
  });
});
