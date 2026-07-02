import { describe, expect, test } from "bun:test";

import type { FeatureHintRegistration } from "@/lib/onboarding/feature-hint-context";
import {
  featureHintQueuePosition,
  getEligibleFeatureHintQueue,
} from "@/lib/onboarding/feature-hint-queue";

function mockRegistration(showWhen: boolean, hasAnchor = true): FeatureHintRegistration {
  return {
    id: "arcadia-starters",
    showWhen,
    anchorRef: {
      current: hasAnchor ? ({} as HTMLElement) : null,
    },
  };
}

describe("feature hint queue", () => {
  test("returns null position when only one hint is queued", () => {
    expect(featureHintQueuePosition(["experience-rail"], "experience-rail")).toBeNull();
  });

  test("reports index and total for multi-hint bursts", () => {
    const queue = ["experience-rail", "composer-search-memory", "composer-auto-model"] as const;

    expect(featureHintQueuePosition([...queue], "experience-rail")).toEqual({
      index: 1,
      total: 3,
    });

    expect(featureHintQueuePosition([...queue], "composer-auto-model")).toEqual({
      index: 3,
      total: 3,
    });
  });

  test("only the first eligible hint is active at a time", () => {
    const registrations = new Map([
      ["experience-rail", { ...mockRegistration(true), id: "experience-rail" as const }],
      [
        "composer-search-memory",
        { ...mockRegistration(true), id: "composer-search-memory" as const },
      ],
    ]);

    const queue = getEligibleFeatureHintQueue({
      hydrated: true,
      guideBreathBlocked: false,
      pathname: "/chat/abc",
      navigationSettled: true,
      registrations,
      dismissRecord: {},
      replayFeatureHints: false,
      sessionDismissedIds: new Set(),
    });

    expect(queue.length).toBeGreaterThanOrEqual(2);
    expect(queue[0]).toBe("experience-rail");
  });

  test("session-dismissed hints stay hidden during replay mode", () => {
    const registrations = new Map([
      ["experience-rail", { ...mockRegistration(true), id: "experience-rail" as const }],
    ]);

    const queue = getEligibleFeatureHintQueue({
      hydrated: true,
      guideBreathBlocked: false,
      pathname: "/chat/abc",
      navigationSettled: true,
      registrations,
      dismissRecord: {},
      replayFeatureHints: true,
      sessionDismissedIds: new Set(["experience-rail"]),
    });

    expect(queue).not.toContain("experience-rail");
  });
});
