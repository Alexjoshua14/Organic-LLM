import { describe, expect, it } from "bun:test";

import { restaurantCardViewTransitionNames } from "@/lib/view-transitions/restaurant-card";

describe("restaurantCardViewTransitionNames", () => {
  it("returns stable scoped names per venue", () => {
    const input = { name: "State Bird Provisions", heroUrl: "https://example.com/hero.jpg" };

    const names = restaurantCardViewTransitionNames(input);

    expect(names.hero).toMatch(/^rc-.+-hero$/);
    expect(names.title).toMatch(/^rc-.+-title$/);
    expect(names.rating).toMatch(/^rc-.+-rating$/);
    expect(restaurantCardViewTransitionNames(input)).toEqual(names);
  });

  it("differentiates venues with the same name", () => {
    const a = restaurantCardViewTransitionNames({
      name: "Cafe Nero",
      heroUrl: "https://example.com/a.jpg",
    });
    const b = restaurantCardViewTransitionNames({
      name: "Cafe Nero",
      heroUrl: "https://example.com/b.jpg",
    });

    expect(a).not.toEqual(b);
  });
});
