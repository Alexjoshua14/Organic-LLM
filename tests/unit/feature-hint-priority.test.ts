import { describe, expect, test } from "bun:test";

import { compareFeatureHintPriority } from "@/lib/onboarding/feature-hint-priority";

describe("feature hint priority", () => {
  test("experience rail precedes composer hints", () => {
    expect(compareFeatureHintPriority("experience-rail", "composer-search-memory")).toBeLessThan(
      0
    );
  });

  test("composer hints precede noesis suggest", () => {
    expect(compareFeatureHintPriority("composer-auto-model", "noesis-suggest-reply")).toBeLessThan(
      0
    );
  });
});
