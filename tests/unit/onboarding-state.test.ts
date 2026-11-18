import { describe, expect, test } from "bun:test";

import {
  IMPLICIT_CLOSES_BEFORE_PERMANENT,
  ONBOARDING_ACCOUNT_WINDOW_DAYS,
  TIP_LOG_WINDOW_MS,
  checklistProgress,
  completeChecklistStep,
  createOnboardingState,
  dismissWelcome,
  isAutoOnboardingEligible,
  isTipSeen,
  markTipSeen,
  migrateLegacyOnboarding,
  parseOnboardingState,
  recordImplicitTipClose,
  recordTipShown,
  replayOnboarding,
  setChecklistHidden,
  setTipsEnabled,
} from "@/lib/onboarding/onboarding-state";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("parseOnboardingState", () => {
  test("round-trips a valid state and fills defaults", () => {
    const state = markTipSeen(createOnboardingState(), "composer-search-memory", 2, "acted", NOW);

    expect(parseOnboardingState(JSON.stringify(state))).toEqual(state);
    expect(parseOnboardingState(JSON.stringify({ v: 1 }))).toEqual(createOnboardingState());
  });

  test("rejects missing, malformed and unknown-version data", () => {
    expect(parseOnboardingState(null)).toBeNull();
    expect(parseOnboardingState("{not json")).toBeNull();
    expect(parseOnboardingState(JSON.stringify([]))).toBeNull();
    expect(parseOnboardingState(JSON.stringify({ v: 99 }))).toBeNull();
    expect(parseOnboardingState(JSON.stringify({ v: 1, tipsEnabled: "yes" }))).toBeNull();
  });
});

describe("tips", () => {
  test("seen is versioned: a newer tip version shows again", () => {
    const state = markTipSeen(createOnboardingState(), "a", 1, "dismissed", NOW);

    expect(isTipSeen(state, "a", 1)).toBe(true);
    expect(isTipSeen(state, "a", 2)).toBe(false);
  });

  test("reducers return the same object when nothing changes", () => {
    const state = markTipSeen(createOnboardingState(), "a", 1, "dismissed", NOW);

    expect(markTipSeen(state, "a", 1, "acted", NOW + 1)).toBe(state);
    expect(setTipsEnabled(state, true)).toBe(state);
    expect(dismissWelcome(dismissWelcome(state, NOW), NOW + 1).welcomeDismissedAt).toBe(NOW);
  });

  test(`the ${IMPLICIT_CLOSES_BEFORE_PERMANENT}nd implicit close becomes permanent`, () => {
    const once = recordImplicitTipClose(createOnboardingState(), "a", 1, NOW);

    expect(isTipSeen(once, "a", 1)).toBe(false);
    expect(once.implicitCloses.a).toBe(1);

    const twice = recordImplicitTipClose(once, "a", 1, NOW + 1);

    expect(isTipSeen(twice, "a", 1)).toBe(true);
    expect(twice.tips.a?.outcome).toBe("dismissed");
  });

  test("the tip log keeps only the rolling window", () => {
    let state = createOnboardingState();

    state = recordTipShown(state, NOW - TIP_LOG_WINDOW_MS - 1);
    state = recordTipShown(state, NOW);

    expect(state.tipLog).toEqual([NOW]);
  });
});

describe("checklist", () => {
  test("progress counts completed steps and completion is idempotent", () => {
    let state = completeChecklistStep(createOnboardingState(), "first-message", NOW);

    expect(completeChecklistStep(state, "first-message", NOW + 5)).toBe(state);
    expect(checklistProgress(state)).toEqual({ done: 1, total: 4, complete: false });

    for (const step of ["try-arcadia", "rabbit-hole", "switch-ideas"] as const) {
      state = completeChecklistStep(state, step, NOW);
    }

    expect(checklistProgress(state).complete).toBe(true);
  });

  test("hide and show", () => {
    const hidden = setChecklistHidden(createOnboardingState(), true, NOW);

    expect(hidden.checklist.hiddenAt).toBe(NOW);
    expect(setChecklistHidden(hidden, true, NOW + 1)).toBe(hidden);
    expect(setChecklistHidden(hidden, false, NOW).checklist.hiddenAt).toBeUndefined();
  });
});

describe("replay", () => {
  test("resets tips and the welcome, turns tips on, keeps real checklist progress", () => {
    let state = createOnboardingState();

    state = markTipSeen(state, "a", 1, "dismissed", NOW);
    state = recordImplicitTipClose(state, "b", 1, NOW);
    state = recordTipShown(state, NOW);
    state = setTipsEnabled(state, false);
    state = dismissWelcome(state, NOW);
    state = completeChecklistStep(state, "first-message", NOW);
    state = setChecklistHidden(state, true, NOW);

    const replayed = replayOnboarding(state, NOW + 10);

    expect(replayed.tips).toEqual({});
    expect(replayed.implicitCloses).toEqual({});
    expect(replayed.tipLog).toEqual([]);
    expect(replayed.tipsEnabled).toBe(true);
    expect(replayed.welcomeDismissedAt).toBeUndefined();
    expect(replayed.replayRequestedAt).toBe(NOW + 10);
    expect(replayed.checklist.done["first-message"]).toBe(NOW);
    expect(replayed.checklist.hiddenAt).toBeUndefined();
  });
});

describe("isAutoOnboardingEligible", () => {
  const fresh = createOnboardingState();

  test(`new accounts (≤${ONBOARDING_ACCOUNT_WINDOW_DAYS} days) qualify; older ones do not`, () => {
    expect(isAutoOnboardingEligible(fresh, new Date(NOW - 2 * DAY), NOW)).toBe(true);
    expect(isAutoOnboardingEligible(fresh, NOW - (ONBOARDING_ACCOUNT_WINDOW_DAYS + 1) * DAY, NOW)).toBe(
      false
    );
  });

  test("unknown account age never qualifies, but replay always does", () => {
    expect(isAutoOnboardingEligible(fresh, null, NOW)).toBe(false);
    expect(isAutoOnboardingEligible(fresh, Number.NaN, NOW)).toBe(false);
    expect(isAutoOnboardingEligible(replayOnboarding(fresh, NOW), null, NOW)).toBe(true);
  });
});

describe("migrateLegacyOnboarding", () => {
  test("carries over dismissal versions for tips that still exist and a hidden checklist", () => {
    const migrated = migrateLegacyOnboarding(
      createOnboardingState(),
      {
        tipDismissals: JSON.stringify({
          "composer-search-memory": 2,
          "experience-rail": 3,
          "arcadia-multiagent": "bad",
        }),
        firstSession: JSON.stringify({ completedSteps: { "start-chat": true }, dismissedAt: 42 }),
      },
      ["composer-search-memory", "arcadia-multiagent"],
      NOW
    );

    expect(migrated.migratedLegacy).toBe(true);
    expect(migrated.tips["composer-search-memory"]?.version).toBe(2);
    expect(migrated.tips["experience-rail"]).toBeUndefined();
    expect(migrated.tips["arcadia-multiagent"]).toBeUndefined();
    expect(migrated.checklist.hiddenAt).toBe(42);
    // Old completions were link clicks, so they prove nothing.
    expect(migrated.checklist.done).toEqual({});
  });

  test("runs once and tolerates corrupt legacy data", () => {
    const migrated = migrateLegacyOnboarding(
      createOnboardingState(),
      { tipDismissals: "{oops", firstSession: "[1,2]" },
      ["composer-search-memory"],
      NOW
    );

    expect(migrated.tips).toEqual({});
    expect(migrateLegacyOnboarding(migrated, { tipDismissals: null, firstSession: null }, [], NOW)).toBe(
      migrated
    );
  });
});
