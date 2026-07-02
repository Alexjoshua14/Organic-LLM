import { afterEach, describe, expect, test } from "bun:test";

import { FEATURE_HINT_GUIDE_POLICY } from "@/lib/onboarding/feature-hint-guide-policy";
import {
  clearSessionFeatureHintDismissals,
  getSessionDismissedFeatureHintIds,
  recordSessionFeatureHintDismiss,
  resetFeatureHintSessionForTests,
} from "@/lib/onboarding/feature-hint-session";

describe("feature hint session dismissals", () => {
  afterEach(() => {
    resetFeatureHintSessionForTests();
  });

  test("persists tab dismissals to sessionStorage", () => {
    recordSessionFeatureHintDismiss("experience-rail");

    expect(
      window.sessionStorage.getItem(FEATURE_HINT_GUIDE_POLICY.sessionDismissedStorageKey)
    ).toBe(JSON.stringify(["experience-rail"]));
  });

  test("hydrates tab dismissals from sessionStorage", () => {
    window.sessionStorage.setItem(
      FEATURE_HINT_GUIDE_POLICY.sessionDismissedStorageKey,
      JSON.stringify(["experience-rail"])
    );

    expect(getSessionDismissedFeatureHintIds().has("experience-rail")).toBe(true);
  });

  test("clearSessionFeatureHintDismissals removes tab dismissals", () => {
    recordSessionFeatureHintDismiss("experience-rail");
    clearSessionFeatureHintDismissals();

    expect(getSessionDismissedFeatureHintIds().size).toBe(0);
    expect(
      window.sessionStorage.getItem(FEATURE_HINT_GUIDE_POLICY.sessionDismissedStorageKey)
    ).toBeNull();
  });
});
