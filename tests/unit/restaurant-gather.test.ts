import { describe, expect, it } from "bun:test";

import { buildRestaurantHours } from "@/lib/restaurant/build-hours";
import { buildRestaurantRating } from "@/lib/restaurant/build-rating";
import { parseMenuFromHtml } from "@/lib/restaurant/fetch-menu";
import { buildTextQuery, resolveSearchResults } from "@/lib/restaurant/search-venue";

describe("restaurant search-venue", () => {
  it("buildTextQuery joins name and city", () => {
    expect(buildTextQuery({ name: "Tartine", city: "San Francisco" })).toBe(
      "Tartine San Francisco"
    );
  });

  it("resolves a single search result", () => {
    const result = resolveSearchResults(
      [
        {
          id: "abc123",
          displayName: { text: "State Bird Provisions" },
          formattedAddress: "1529 Fillmore St, San Francisco, CA",
        },
      ],
      "State Bird Provisions",
      "San Francisco"
    );

    expect(result).toEqual({
      kind: "resolved",
      placeId: "abc123",
      name: "State Bird Provisions",
    });
  });

  it("returns ambiguous when multiple matches remain", () => {
    const result = resolveSearchResults(
      [
        {
          id: "a",
          displayName: { text: "Tartine" },
          formattedAddress: "San Francisco, CA",
        },
        {
          id: "b",
          displayName: { text: "Tartine" },
          formattedAddress: "Los Angeles, CA",
        },
      ],
      "Tartine"
    );

    expect(result.kind).toBe("ambiguous");

    if (result.kind === "ambiguous") {
      expect(result.candidates).toHaveLength(2);
    }
  });
});

describe("buildRestaurantRating", () => {
  it("maps Google rating fields", () => {
    const rating = buildRestaurantRating({
      placeId: "x",
      rating: 4.6,
      userRatingCount: 1520,
    });

    expect(rating).toEqual({
      average: 4.6,
      reviewCount: 1520,
      sources: [{ name: "google", rating: 4.6, reviewCount: 1520 }],
    });
  });
});

describe("buildRestaurantHours", () => {
  it("maps Google opening periods to schema days", () => {
    const hours = buildRestaurantHours({
      placeId: "x",
      regularOpeningHours: {
        periods: [
          {
            open: { day: 2, hour: 17, minute: 30 },
            close: { day: 2, hour: 22, minute: 0 },
          },
        ],
      },
    });

    expect(hours?.regular).toEqual([
      { day: "tuesday", open: "5:30 pm", close: "10pm" },
    ]);
  });
});

describe("parseMenuFromHtml", () => {
  it("extracts schema.org menu sections", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Menu",
        "hasMenuSection": [{
          "@type": "MenuSection",
          "name": "Mains",
          "hasMenuItem": [{
            "@type": "MenuItem",
            "name": "Burger",
            "offers": { "price": "18" }
          }]
        }]
      }
      </script>
    `;

    const menu = parseMenuFromHtml(html);

    expect(menu?.sections[0]?.name).toBe("Mains");
    expect(menu?.sections[0]?.items[0]?.name).toBe("Burger");
    expect(menu?.sections[0]?.items[0]?.price).toBe("$18");
  });
});
