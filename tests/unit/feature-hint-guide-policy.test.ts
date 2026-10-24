import { describe, expect, test } from "bun:test";

import {
  MAX_CONSECUTIVE_AUTO_FEATURE_HINTS,
  clearFeatureHintGuideBreath,
  createInitialFeatureHintSessionState,
  featureHintSurfaceKey,
  recordAutoFeatureHintDismissed,
  shouldBlockAutoFeatureHints,
  shouldEnterGuideBreathPause,
  syncFeatureHintSessionSurface,
} from "@/lib/onboarding/feature-hint-guide-policy";

describe("feature hint guide policy", () => {
  test("caps consecutive auto hints at four for returning users", () => {
    let session = createInitialFeatureHintSessionState("chat", true);

    for (let i = 0; i < MAX_CONSECUTIVE_AUTO_FEATURE_HINTS - 1; i++) {
      session = recordAutoFeatureHintDismissed(session);
      expect(session.breathPaused).toBe(false);
    }

    session = recordAutoFeatureHintDismissed(session);
    expect(session.consecutiveAutoDismissCount).toBe(MAX_CONSECUTIVE_AUTO_FEATURE_HINTS);
    expect(session.breathPaused).toBe(true);
    expect(
      shouldBlockAutoFeatureHints(session, {
        replayFeatureHints: false,
        explicitGuideRequested: false,
      })
    ).toBe(true);
  });

  test("beginning session exempts breath pause until real UI interaction", () => {
    let session = createInitialFeatureHintSessionState("chat", false);

    for (let i = 0; i < MAX_CONSECUTIVE_AUTO_FEATURE_HINTS + 1; i++) {
      session = recordAutoFeatureHintDismissed(session);
    }

    expect(session.breathPaused).toBe(false);
    expect(shouldEnterGuideBreathPause(session.consecutiveAutoDismissCount, { isBeginningSession: true })).toBe(
      false
    );

    session = clearFeatureHintGuideBreath(session);
    expect(session.isBeginningSession).toBe(false);
  });

  test("explicit request and replay bypass breath pause", () => {
    const paused = {
      ...createInitialFeatureHintSessionState("chat", true),
      consecutiveAutoDismissCount: 4,
      breathPaused: true,
    };

    expect(
      shouldBlockAutoFeatureHints(paused, {
        replayFeatureHints: true,
        explicitGuideRequested: false,
      })
    ).toBe(false);

    expect(
      shouldBlockAutoFeatureHints(paused, {
        replayFeatureHints: false,
        explicitGuideRequested: true,
      })
    ).toBe(false);
  });

  test("navigation across surfaces resets the consecutive counter", () => {
    let session = {
      ...createInitialFeatureHintSessionState("chat", true),
      consecutiveAutoDismissCount: 3,
      breathPaused: false,
    };

    session = syncFeatureHintSessionSurface(session, featureHintSurfaceKey("/sandbox/arcadia"));

    expect(session.surfaceKey).toBe("arcadia");
    expect(session.consecutiveAutoDismissCount).toBe(0);
    expect(session.breathPaused).toBe(false);
  });
});
