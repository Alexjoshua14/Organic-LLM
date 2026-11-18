import { describe, expect, test } from "bun:test";

import { threadEntryPrefetch } from "@/lib/chat/thread-entry-navigation";
import { CHECKLIST_STEPS } from "@/lib/onboarding/checklist";
import {
  AUTO_FEATURE_TIPS,
  AUTO_FEATURE_TIP_IDS,
  featureTipBody,
  guideTipList,
} from "@/lib/onboarding/feature-tips";
import { GUIDE_SURFACES, guideSurfaces } from "@/lib/onboarding/guide-surfaces";
import { CHECKLIST_STEP_IDS } from "@/lib/onboarding/onboarding-state";

describe("Guide surfaces", () => {
  test("admin-only surfaces are hidden from everyone else", () => {
    const everyone = guideSurfaces({ isAdmin: false }).map((surface) => surface.id);
    const admin = guideSurfaces({ isAdmin: true }).map((surface) => surface.id);

    expect(everyone).toEqual(["chat", "arcadia", "rabbit-holes", "remy", "ergon", "speak"]);
    expect(admin).toEqual(GUIDE_SURFACES.map((surface) => surface.id));
  });

  test("every surface has an in-app link and a one-line summary", () => {
    for (const surface of GUIDE_SURFACES) {
      expect(surface.href.startsWith("/")).toBe(true);
      expect(surface.href.startsWith("/blog")).toBe(false);
      expect(surface.summary.length).toBeGreaterThan(10);
      expect(surface.summary.length).toBeLessThanOrEqual(90);
    }
  });

  test("thread-creating links are never prefetched", () => {
    const chat = GUIDE_SURFACES.find((surface) => surface.id === "chat")!;
    const arcadia = GUIDE_SURFACES.find((surface) => surface.id === "arcadia")!;

    expect(threadEntryPrefetch(chat.href)).toBe(false);
    expect(threadEntryPrefetch(arcadia.href)).toBe(false);
  });
});

describe("Feature tips", () => {
  test("automatic tips stay few, short and versioned", () => {
    expect(AUTO_FEATURE_TIP_IDS.length).toBeLessThanOrEqual(3);

    for (const id of AUTO_FEATURE_TIP_IDS) {
      const tip = AUTO_FEATURE_TIPS[id];

      expect(tip.id).toBe(id);
      expect(tip.title.length).toBeLessThanOrEqual(32);
      expect(tip.body.length).toBeLessThanOrEqual(220);
      expect(Number.isInteger(tip.version)).toBe(true);
    }
  });

  test("every automatic tip can be found again in the Guide", () => {
    const listed = guideTipList({ isAdmin: false }).map((tip) => tip.id);

    for (const id of AUTO_FEATURE_TIP_IDS) expect(listed).toContain(id);
  });

  test("admin-only tips are filtered", () => {
    const everyone = guideTipList({ isAdmin: false });

    expect(everyone.every((tip) => tip.audience === "everyone")).toBe(true);
    expect(guideTipList({ isAdmin: true }).length).toBeGreaterThan(everyone.length);
  });

  test("Ctrl-only panel shortcuts are mentioned on Apple platforms only", () => {
    const tip = AUTO_FEATURE_TIPS["arcadia-multiagent"];

    expect(featureTipBody(tip, false)).not.toContain("Control-W");
    expect(featureTipBody(tip, true)).toContain("Control-W");
  });
});

describe("First steps", () => {
  test("covers every checklist step once, in order", () => {
    expect(CHECKLIST_STEPS.map((step) => step.id)).toEqual([...CHECKLIST_STEP_IDS]);
  });

  test("link steps point into the app", () => {
    for (const step of CHECKLIST_STEPS) {
      if (step.action.kind === "link") expect(step.action.href.startsWith("/")).toBe(true);
    }
  });
});
