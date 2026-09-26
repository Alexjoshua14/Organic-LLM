import { describe, expect, test } from "bun:test";

import {
  AION_COALESCE_WINDOW_MS,
  AION_EVENT_DEBOUNCE_MS,
  AION_IDLE_DORMANT_MS,
  decideAionTurnTier,
} from "@/lib/aion/presence/turn-policy";
import type { AionEvent } from "@/lib/schemas/aion-presence";

function event(overrides: Partial<AionEvent> = {}): AionEvent {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "button",
    surface: "event-bench",
    label: "Save",
    at: Date.now(),
    ...overrides,
  };
}

const baseSettings = {
  enabled: true,
  idleMs: 1_000,
  msSinceSameCoalesceKey: 0,
  busy: false,
};

describe("decideAionTurnTier", () => {
  test("user messages are always full turns", () => {
    const decision = decideAionTurnTier(event({ kind: "message", label: "Hello" }), baseSettings);

    expect(decision.tier).toBe("full");
    expect(decision.delayMs).toBe(0);
    expect(decision.reason).toBe("user-message");
  });

  test("UI events become micro-turns after debounce", () => {
    const decision = decideAionTurnTier(event(), baseSettings);

    expect(decision.tier).toBe("micro");
    expect(decision.delayMs).toBe(AION_EVENT_DEBOUNCE_MS);
    expect(decision.reason).toBe("ui-event");
    expect(decision.coalesceKey).toBe("button:event-bench:Save");
  });

  test("coalesces rapid repeats of the same key", () => {
    const decision = decideAionTurnTier(event(), {
      ...baseSettings,
      msSinceSameCoalesceKey: AION_COALESCE_WINDOW_MS - 1,
    });

    expect(decision.tier).toBe("none");
    expect(decision.reason).toBe("coalesced");
  });

  test("allows a micro-turn once the coalesce window has passed", () => {
    const decision = decideAionTurnTier(event(), {
      ...baseSettings,
      msSinceSameCoalesceKey: AION_COALESCE_WINDOW_MS + 1,
    });

    expect(decision.tier).toBe("micro");
  });

  test("drops transient hover/scroll system noise to the ledger", () => {
    const decision = decideAionTurnTier(
      event({ kind: "system", label: "hover card" }),
      baseSettings
    );

    expect(decision.tier).toBe("none");
    expect(decision.reason).toBe("transient-noise");
  });

  test("wakes from dormancy with a micro-turn", () => {
    const decision = decideAionTurnTier(event(), {
      ...baseSettings,
      idleMs: AION_IDLE_DORMANT_MS,
    });

    expect(decision.tier).toBe("micro");
    expect(decision.reason).toBe("wake-from-dormant");
  });

  test("stays silent while a turn is in flight", () => {
    const decision = decideAionTurnTier(event(), { ...baseSettings, busy: true });

    expect(decision.tier).toBe("none");
    expect(decision.reason).toBe("busy");
  });

  test("respects the enabled flag", () => {
    const decision = decideAionTurnTier(event(), { ...baseSettings, enabled: false });

    expect(decision.tier).toBe("none");
    expect(decision.reason).toBe("disabled");
  });
});
