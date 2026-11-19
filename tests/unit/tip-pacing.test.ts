import { describe, expect, test } from "bun:test";

import type { FeatureTipInstance } from "@/lib/onboarding/feature-tip-registry";

import {
  createOnboardingState,
  markTipSeen,
  setTipsEnabled,
} from "@/lib/onboarding/onboarding-state";
import { selectTipCandidates, tipPacingBlock } from "@/lib/onboarding/tip-pacing";
import { TIP_TIMING } from "@/lib/onboarding/tip-timing";

const NOW = 1_800_000_000_000;

const settled = {
  now: NOW,
  routeEnteredAt: NOW - TIP_TIMING.settleMs,
  lastActivityAt: NOW - TIP_TIMING.idleMs,
  documentHidden: false,
  shownThisVisit: false,
  tipLog: [] as number[],
};

describe("tipPacingBlock", () => {
  test("allows a tip once settled, idle and under the caps", () => {
    expect(tipPacingBlock(settled)).toBeNull();
  });

  test("waits for the route to settle and for a pause", () => {
    expect(tipPacingBlock({ ...settled, routeEnteredAt: NOW - 10 })).toBe("settling");
    expect(tipPacingBlock({ ...settled, lastActivityAt: NOW - 10 })).toBe("active");
  });

  test("never in a background tab, and once per route visit", () => {
    expect(tipPacingBlock({ ...settled, documentHidden: true })).toBe("document-hidden");
    expect(tipPacingBlock({ ...settled, shownThisVisit: true })).toBe("shown-this-visit");
  });

  test("keeps the cooldown and the rolling cap", () => {
    expect(tipPacingBlock({ ...settled, tipLog: [NOW - 1000] })).toBe("cooldown");
    expect(
      tipPacingBlock({
        ...settled,
        tipLog: [NOW - 3 * 60 * 60 * 1000, NOW - 2 * 60 * 60 * 1000],
      })
    ).toBe("window-cap");
    // Entries older than the window no longer count.
    expect(tipPacingBlock({ ...settled, tipLog: [NOW - 25 * 60 * 60 * 1000] })).toBeNull();
  });
});

function instance(
  key: string,
  id: FeatureTipInstance["id"],
  showWhen = true
): FeatureTipInstance {
  return { key, id, showWhen, getElement: () => null };
}

describe("selectTipCandidates", () => {
  const base = {
    pathname: "/sandbox/arcadia/abc",
    state: createOnboardingState(),
    sessionHiddenTips: new Set<string>(),
    autoEligible: true,
  };

  test("orders by registry priority, then mount order, and skips showWhen=false", () => {
    const instances = [
      instance("m", "arcadia-multiagent"),
      instance("c1", "composer-search-memory", false),
      instance("c2", "composer-search-memory"),
    ];

    expect(selectTipCandidates(instances, base).map((entry) => entry.key)).toEqual(["c2", "m"]);
  });

  test("respects path prefixes", () => {
    expect(
      selectTipCandidates([instance("m", "arcadia-multiagent")], { ...base, pathname: "/chat/x" })
    ).toEqual([]);
  });

  test("skips seen, session-hidden, tips-off and ineligible accounts", () => {
    const instances = [instance("c", "composer-search-memory")];

    expect(
      selectTipCandidates(instances, {
        ...base,
        state: markTipSeen(base.state, "composer-search-memory", 2, "dismissed", NOW),
      })
    ).toEqual([]);
    expect(
      selectTipCandidates(instances, {
        ...base,
        sessionHiddenTips: new Set(["composer-search-memory"]),
      })
    ).toEqual([]);
    expect(selectTipCandidates(instances, { ...base, state: setTipsEnabled(base.state, false) })).toEqual(
      []
    );
    expect(selectTipCandidates(instances, { ...base, autoEligible: false })).toEqual([]);
  });

  test("a dismissal of an older version does not hide the current one", () => {
    const state = markTipSeen(base.state, "composer-search-memory", 1, "dismissed", NOW);

    expect(selectTipCandidates([instance("c", "composer-search-memory")], { ...base, state })).toHaveLength(
      1
    );
  });
});
