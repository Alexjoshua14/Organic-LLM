import { describe, expect, test } from "bun:test";

import { SHOWCASE_TOUR } from "@/lib/showcase/feature-tour";
import { FIELD_TRIP, FIELD_TRIP_INTRO } from "@/lib/showcase/field-trip";

describe("showcase field trip", () => {
  test("tells every tour feature once, in tour order", () => {
    expect(FIELD_TRIP.map((c) => c.slug)).toEqual(SHOWCASE_TOUR.map((s) => s.slug));
  });

  test("each chapter has a distinct moment, label and narration", () => {
    for (const key of ["when", "label", "headline", "narration"] as const) {
      const values = FIELD_TRIP.map((c) => c[key].trim());

      expect(values.every((v) => v.length > 0)).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  test("labels match the tour facets so the bar and the pages agree", () => {
    FIELD_TRIP.forEach((chapter, index) => expect(chapter.label).toBe(SHOWCASE_TOUR[index]!.facet));
  });

  test("introduces the shared project", () => {
    expect(FIELD_TRIP_INTRO).toContain("Milky Way");
  });
});
