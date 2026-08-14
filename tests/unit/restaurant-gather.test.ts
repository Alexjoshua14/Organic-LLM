import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { assembleRestaurantCard } from "@/lib/restaurant/assemble-card";
import { buildRestaurantAddress } from "@/lib/restaurant/build-address";
import { buildRestaurantHours } from "@/lib/restaurant/build-hours";
import { buildRestaurantPhotos } from "@/lib/restaurant/build-photos";
import { buildRestaurantRating } from "@/lib/restaurant/build-rating";
import { buildRestaurantSummary } from "@/lib/restaurant/build-summary";
import { parseMenuFromHtml } from "@/lib/restaurant/fetch-menu";
import { buildTextQuery, resolveSearchResults } from "@/lib/restaurant/search-venue";
import { googlePlacesPhotoReply } from "../helpers/google-places-fetch";
import { createMockFetch } from "../helpers/mock-fetch";
import { MOCK_VENUE_BUNDLE } from "../helpers/restaurant-fixtures";
import { registerUpstashRateLimitMocks } from "../helpers/rate-limit-upstash";

mock.module("server-only", () => ({}));

registerUpstashRateLimitMocks();

const ORIGINAL_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

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

describe("buildRestaurantAddress", () => {
  it("maps contact fields and action links", () => {
    const patch = buildRestaurantAddress(MOCK_VENUE_BUNDLE);

    expect(patch.address).toBe(MOCK_VENUE_BUNDLE.formattedAddress);
    expect(patch.phone).toBe(MOCK_VENUE_BUNDLE.nationalPhoneNumber);
    expect(patch.links?.website).toBe(MOCK_VENUE_BUNDLE.websiteUri);
    expect(patch.links?.googleMaps).toBe(MOCK_VENUE_BUNDLE.googleMapsUri);
    expect(patch.links?.directions).toContain(encodeURIComponent(MOCK_VENUE_BUNDLE.formattedAddress!));
  });
});

describe("buildRestaurantSummary", () => {
  it("maps primary type and editorial summary", () => {
    const patch = buildRestaurantSummary(MOCK_VENUE_BUNDLE);

    expect(patch.storeType).toBe("fine_dining");
    expect(patch.summary).toBe(MOCK_VENUE_BUNDLE.editorialSummary?.text);
  });
});

describe("assembleRestaurantCard", () => {
  it("builds a versioned restaurant-card block", () => {
    const block = assembleRestaurantCard({
      name: MOCK_VENUE_BUNDLE.displayName!.text!,
      heroImage: { url: "https://example.com/hero.jpg", alt: "Hero" },
      gallery: [],
      storeType: "fine_dining",
      address: MOCK_VENUE_BUNDLE.formattedAddress,
    });

    expect(block).toMatchObject({
      type: "restaurant-card",
      version: 1,
      name: "State Bird Provisions",
      storeType: "fine_dining",
      gallery: [],
    });
  });
});

describe("buildRestaurantPhotos", () => {
  let fetchMock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";
    fetchMock = createMockFetch(
      Array.from({ length: 4 }, (_, index) =>
        googlePlacesPhotoReply(`https://example.com/photo-${index + 1}.jpg`)
      )
    );
  });

  afterEach(() => {
    fetchMock.restore();

    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
      process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_API_KEY;
    }
  });

  it("resolves hero plus up to three gallery photos via Places media HTTP", async () => {
    const photos = await buildRestaurantPhotos("user-1", MOCK_VENUE_BUNDLE, "State Bird Provisions");

    expect(photos.heroImage?.url).toBe("https://example.com/photo-1.jpg");
    expect(photos.gallery).toHaveLength(3);
    expect(fetchMock.calls.length).toBe(4);
    expect(String(fetchMock.calls[0]![0])).toContain("/photos/hero/media");
  });
});
