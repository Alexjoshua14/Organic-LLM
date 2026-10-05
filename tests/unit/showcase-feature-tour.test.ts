import { describe, expect, test } from "bun:test";

import { SHOWCASE_TOUR, showcaseTourStop } from "@/lib/showcase/feature-tour";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";

describe("showcase feature tour", () => {
  test("each stop is a distinct facet with a matching route", () => {
    const slugs = SHOWCASE_TOUR.map((s) => s.slug);
    const facets = SHOWCASE_TOUR.map((s) => s.facet);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(facets).size).toBe(facets.length);
    SHOWCASE_TOUR.forEach((stop) => expect(stop.href).toBe(`/showcase/${stop.slug}`));
  });

  test("neighbours walk the tour in order", () => {
    const first = showcaseTourStop(SHOWCASE_TOUR[0]!.slug);
    const last = showcaseTourStop(SHOWCASE_TOUR[SHOWCASE_TOUR.length - 1]!.slug);

    expect(first.previous).toBeNull();
    expect(first.next?.slug).toBe(SHOWCASE_TOUR[1]!.slug);
    expect(last.next).toBeNull();
    expect(last.index).toBe(SHOWCASE_TOUR.length - 1);
  });

  test("the shared story's chosen site is one of its candidates", () => {
    expect(SHOWCASE_STORY.sites.map((s) => s.id)).toContain(SHOWCASE_STORY.choice);
  });
});
