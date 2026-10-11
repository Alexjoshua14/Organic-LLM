import { describe, expect, test } from "bun:test";

import { stepFlipOffset } from "@/hooks/use-morph-flip";
import { COMPOSER_SHIFT_SPRING } from "@/lib/chat/composer-shift-spring";
import {
  canToggleArcadiaMultitaskView,
  desktopChatWiderThanAgentColumn,
  formatSendTargetLabel,
  MULTITASK_DASHBOARD_WIDE_MIN_PX,
  MULTITASK_DESKTOP_AGENT_COL_MAX_PX,
  MULTITASK_DESKTOP_PAD_TOP_PX,
  multitaskCondensedCardsInView,
  resolveArcadiaMultitaskLayoutMode,
} from "@/lib/arcadia/multitask/layout-mode";
import {
  multitaskViewStorageKey,
  parseMultitaskViewStored,
  serializeMultitaskViewStored,
} from "@/lib/arcadia/multitask/view-sync";
import {
  queueAgentIdFromSendTarget,
  sendTargetFromQueueAgentId,
} from "@/lib/schemas/arcadia-multitask-send-target";

describe("resolveArcadiaMultitaskLayoutMode", () => {
  test("defaults to overlay when the per-thread toggle is off", () => {
    expect(resolveArcadiaMultitaskLayoutMode(false)).toBe("overlay");
  });

  test("dashboard only when the user toggle is on — not forced by agents", () => {
    expect(resolveArcadiaMultitaskLayoutMode(true)).toBe("dashboard");
  });

  test("a working agent alone does not imply dashboard (toggle is separate)", () => {
    // Regression: previous API took agent statuses and forced dashboard on.
    expect(resolveArcadiaMultitaskLayoutMode(false)).toBe("overlay");
  });
});

describe("canToggleArcadiaMultitaskView", () => {
  test("refuses while the thread has an active stream", () => {
    expect(canToggleArcadiaMultitaskView({ activeStreamId: "stream-abc" })).toBe(false);
    expect(canToggleArcadiaMultitaskView({ activeStreamId: "  " })).toBe(true);
  });

  test("allows when idle (null / undefined stream)", () => {
    expect(canToggleArcadiaMultitaskView({ activeStreamId: null })).toBe(true);
    expect(canToggleArcadiaMultitaskView({ activeStreamId: undefined })).toBe(true);
  });
});

describe("multitask view local cache keys", () => {
  test("storage key is scoped to the thread id", () => {
    const a = multitaskViewStorageKey("11111111-1111-4111-8111-111111111111");
    const b = multitaskViewStorageKey("22222222-2222-4222-8222-222222222222");

    expect(a).toContain("11111111-1111-4111-8111-111111111111");
    expect(a).not.toBe(b);
  });

  test("round-trips serialize/parse for same-tab broadcast payloads", () => {
    const payload = {
      threadId: "11111111-1111-4111-8111-111111111111",
      enabled: true,
      updatedAt: 1_700_000_000_000,
    };
    const raw = serializeMultitaskViewStored(payload);
    const parsed = parseMultitaskViewStored(raw);

    expect(parsed).toEqual(payload);
  });

  test("parse rejects garbage", () => {
    expect(parseMultitaskViewStored("not-json")).toBeNull();
    expect(parseMultitaskViewStored("{}")).toBeNull();
  });
});

describe("formatSendTargetLabel", () => {
  test("labels orchestrator and named subagents", () => {
    const agents = [{ id: "agent-coder", name: "Reed" }];

    expect(formatSendTargetLabel({ kind: "orchestrator" }, agents)).toBe("Orchestrator");
    expect(formatSendTargetLabel({ kind: "subagent", agentId: "agent-coder" }, agents)).toBe(
      "Reed"
    );
  });
});

describe("desktop multitask spacing", () => {
  test("top pad keeps the header off the viewport edge", () => {
    expect(MULTITASK_DESKTOP_PAD_TOP_PX).toBeGreaterThanOrEqual(16);
  });

  test("chat column wins width over the capped agent board on desktop", () => {
    expect(desktopChatWiderThanAgentColumn(MULTITASK_DASHBOARD_WIDE_MIN_PX)).toBe(true);
    expect(MULTITASK_DESKTOP_AGENT_COL_MAX_PX).toBeLessThanOrEqual(320);
  });
});

describe("queueAgentIdFromSendTarget", () => {
  test("omits agent id for orchestrator", () => {
    expect(queueAgentIdFromSendTarget({ kind: "orchestrator" })).toBeUndefined();
  });

  test("maps subagent send target to queueTargetAgentId", () => {
    expect(queueAgentIdFromSendTarget({ kind: "subagent", agentId: "agent-coder" })).toBe(
      "agent-coder"
    );
  });

  test("round-trips with sendTargetFromQueueAgentId", () => {
    expect(queueAgentIdFromSendTarget(sendTargetFromQueueAgentId("agent-planner"))).toBe(
      "agent-planner"
    );
  });
});

describe("condensed multiagent swipe row", () => {
  test("a phone shows a few compact cards, with a partial one hinting the row scrolls", () => {
    const cards = multitaskCondensedCardsInView(390);

    expect(cards).toBeGreaterThanOrEqual(2.4);
    expect(cards % 1).toBeGreaterThan(0.2);
    expect(multitaskCondensedCardsInView(360)).toBeGreaterThanOrEqual(2);
  });
});

describe("CoreInput shift spring", () => {
  test("a layout shift springs back to rest quickly without a visible bounce", () => {
    let state = { offset: { x: 0, y: 120 }, velocity: { x: 0, y: 0 }, settled: false };
    let elapsed = 0;
    let overshoot = 0;

    while (!state.settled && elapsed < 2_000) {
      state = stepFlipOffset(state.offset, state.velocity, COMPOSER_SHIFT_SPRING, 16);
      elapsed += 16;
      overshoot = Math.min(overshoot, state.offset.y);
    }

    expect(state.settled).toBe(true);
    expect(state.offset).toEqual({ x: 0, y: 0 });
    expect(elapsed).toBeLessThan(600);
    expect(overshoot).toBeGreaterThan(-2);
  });
});
