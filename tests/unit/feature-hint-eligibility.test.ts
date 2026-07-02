import { describe, expect, test } from "bun:test";

import {
  getSurfaceEntryHintForPath,
  GLOBAL_HINTS_DEFERRED_ON_SURFACE,
  isFeatureHintEligibleForContext,
  isSurfaceEntryHintPending,
} from "@/lib/onboarding/feature-hint-eligibility";
import type { FeatureHintRegistration } from "@/lib/onboarding/feature-hint-context";

function mockRegistration(showWhen: boolean, hasAnchor = true): FeatureHintRegistration {
  return {
    id: "arcadia-starters",
    showWhen,
    anchorRef: {
      current: hasAnchor ? ({} as HTMLElement) : null,
    },
  };
}

describe("feature hint eligibility", () => {
  test("maps surface paths to entry hints", () => {
    expect(getSurfaceEntryHintForPath("/sandbox/arcadia/new")).toBe("arcadia-starters");
    expect(getSurfaceEntryHintForPath("/sandbox/topic-explore/abc")).toBe("noesis-sparks");
    expect(getSurfaceEntryHintForPath("/chat/123")).toBeNull();
  });

  test("defers global hints when a surface entry hint is pending on Arcadia", () => {
    const registrations = new Map([
      ["arcadia-starters", { ...mockRegistration(true), id: "arcadia-starters" as const }],
    ]);

    expect(
      isSurfaceEntryHintPending("/sandbox/arcadia", registrations, {}, false)
    ).toBe(true);

    for (const globalHint of GLOBAL_HINTS_DEFERRED_ON_SURFACE) {
      expect(
        isFeatureHintEligibleForContext(globalHint, {
          pathname: "/sandbox/arcadia",
          navigationSettled: true,
          registrations,
          dismissRecord: {},
          replayFeatureHints: false,
        })
      ).toBe(false);
    }

    expect(
      isFeatureHintEligibleForContext("arcadia-starters", {
        pathname: "/sandbox/arcadia",
        navigationSettled: true,
        registrations,
        dismissRecord: {},
        replayFeatureHints: false,
      })
    ).toBe(true);
  });

  test("waits for navigation to settle on deferred surface hints", () => {
    const registrations = new Map([
      ["arcadia-starters", { ...mockRegistration(true), id: "arcadia-starters" as const }],
    ]);

    expect(
      isFeatureHintEligibleForContext("arcadia-starters", {
        pathname: "/sandbox/arcadia",
        navigationSettled: false,
        registrations,
        dismissRecord: {},
        replayFeatureHints: false,
      })
    ).toBe(false);

    expect(
      isFeatureHintEligibleForContext("arcadia-starters", {
        pathname: "/sandbox/arcadia",
        navigationSettled: true,
        registrations,
        dismissRecord: {},
        replayFeatureHints: false,
      })
    ).toBe(true);
  });

  test("scopes surface hints to their path prefix", () => {
    const registrations = new Map([
      ["noesis-sparks", { ...mockRegistration(true), id: "noesis-sparks" as const }],
    ]);

    expect(
      isFeatureHintEligibleForContext("noesis-sparks", {
        pathname: "/sandbox/arcadia",
        navigationSettled: true,
        registrations,
        dismissRecord: {},
        replayFeatureHints: false,
      })
    ).toBe(false);
  });
});
