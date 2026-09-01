import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { googlePlacesGatherFetchQueue, createGooglePlacesAndMenuFetchMock } from "../helpers/google-places-fetch";
import { createMockFetch } from "../helpers/mock-fetch";
import { MOCK_VENUE_BUNDLE } from "../helpers/restaurant-fixtures";
import { registerUpstashRateLimitMocks } from "../helpers/rate-limit-upstash";

mock.module("server-only", () => ({}));

registerUpstashRateLimitMocks();

const ORIGINAL_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

describe("gatherRestaurant pipeline (fetch mocks)", () => {
  let fetchMock: ReturnType<typeof createMockFetch>;
  let gatherRestaurant: typeof import("@/lib/restaurant/gather-restaurant").gatherRestaurant;

  beforeEach(async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";
    const routed = createGooglePlacesAndMenuFetchMock(4);
    fetchMock = createMockFetch([], { route: (url) => routed.route(url) });
    gatherRestaurant = (await import("@/lib/restaurant/gather-restaurant")).gatherRestaurant;
  });

  afterEach(() => {
    fetchMock.restore();

    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
      process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_API_KEY;
    }
  });

  test("resolves a venue through Google Places HTTP and optional menu fetch", async () => {
    const result = await gatherRestaurant("user-1", {
      name: "State Bird Provisions",
      city: "San Francisco",
    });

    expect(result.status).toBe("resolved");

    if (result.status !== "resolved") {
      throw new Error("expected resolved venue");
    }

    expect(result.block.name).toBe("State Bird Provisions");
    expect(result.block.heroImage.url).toBe("https://example.com/photo-1.jpg");
    expect(result.block.gallery).toHaveLength(3);
    expect(result.block.menu?.sections[0]?.name).toBe("Mains");
    expect(result.block.rating?.sources).toEqual([
      { name: "google", rating: 4.6, reviewCount: 1520 },
    ]);

    expect(fetchMock.calls.length).toBe(7);
    expect(
      fetchMock.calls.filter(([url]) => String(url).includes("places.googleapis.com")).length
    ).toBe(6);
    expect(
      fetchMock.calls.some(([url]) => String(url) === MOCK_VENUE_BUNDLE.websiteUri)
    ).toBe(true);
  });

  test("returns ambiguous when search has multiple matches", async () => {
    fetchMock.restore();
    fetchMock = createMockFetch([
      {
        body: {
          places: [
            {
              id: "places/tartine-sf",
              displayName: { text: "Tartine" },
              formattedAddress: "San Francisco, CA",
            },
            {
              id: "places/tartine-la",
              displayName: { text: "Tartine" },
              formattedAddress: "Los Angeles, CA",
            },
          ],
        },
      },
    ]);

    const result = await gatherRestaurant("user-1", { name: "Tartine" });

    expect(result.status).toBe("ambiguous");
    expect(fetchMock.calls.length).toBe(1);
  });

  test("returns error when photos cannot be resolved", async () => {
    fetchMock.restore();
    fetchMock = createMockFetch([
      ...googlePlacesGatherFetchQueue(1).slice(0, 2),
      { status: 500, body: { error: "photo unavailable" } },
    ]);

    const result = await gatherRestaurant("user-1", {
      name: "State Bird Provisions",
      city: "San Francisco",
    });

    expect(result).toEqual({
      status: "error",
      error: "Could not load photos for this venue",
    });
  });
});
