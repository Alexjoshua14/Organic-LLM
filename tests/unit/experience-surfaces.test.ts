import { describe, expect, test } from "bun:test";

import { EXPERIENCE_SURFACES } from "@/lib/onboarding/experience-surfaces";

describe("experience surfaces guide", () => {
  test("covers every rail segment with a short description", () => {
    expect(EXPERIENCE_SURFACES.map((s) => s.id)).toEqual([
      "chat",
      "arcadia",
      "noesis",
      "strata",
      "rabbitholes",
      "ergon",
      "remy",
    ]);

    for (const surface of EXPERIENCE_SURFACES) {
      expect(surface.slug.length).toBeGreaterThan(0);
      expect(surface.tryHref.startsWith("/")).toBe(true);
      expect(surface.label.length).toBeGreaterThan(0);
      expect(surface.description.length).toBeGreaterThan(10);
      expect(surface.description.length).toBeLessThan(80);
    }
  });
});
