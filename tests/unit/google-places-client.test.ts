import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  googlePlacesDetailsReply,
  googlePlacesPhotoReply,
  googlePlacesSearchReply,
} from "../helpers/google-places-fetch";
import { createMockFetch } from "../helpers/mock-fetch";
import { MOCK_PLACE_SEARCH_RESULT, MOCK_VENUE_BUNDLE } from "../helpers/restaurant-fixtures";
import {
  registerUpstashRateLimitMocks,
  sharedRatelimitLimit,
} from "../helpers/rate-limit-upstash";

mock.module("server-only", () => ({}));

registerUpstashRateLimitMocks();

const ORIGINAL_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

describe("lib/google-places/client", () => {
  let fetchMock: ReturnType<typeof createMockFetch>;
  let client: typeof import("@/lib/google-places/client");

  beforeEach(async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";
    sharedRatelimitLimit.mockClear();
    sharedRatelimitLimit.mockResolvedValue({ success: true, remaining: 50 });
    fetchMock = createMockFetch();
    client = await import("@/lib/google-places/client");
  });

  afterEach(() => {
    fetchMock.restore();

    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
      process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_API_KEY;
    }
  });

  test("textSearchPlaces POSTs to searchText with field mask and API key", async () => {
    fetchMock.enqueue(googlePlacesSearchReply());

    const result = await client.textSearchPlaces("user-1", {
      textQuery: "State Bird Provisions San Francisco",
      maxResultCount: 5,
      locationBias: { latitude: 37.77, longitude: -122.42, radiusMeters: 10_000 },
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("expected search success");
    }

    expect(result.data.places?.[0]?.id).toBe(MOCK_PLACE_SEARCH_RESULT.id);

    const [url, init] = fetchMock.calls[0]!;
    expect(String(url)).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(
      "test-google-places-key"
    );
    expect((init?.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain("places.id");

    const body = JSON.parse(String(init?.body));

    expect(body.textQuery).toBe("State Bird Provisions San Francisco");
    expect(body.locationBias.circle.center.latitude).toBe(37.77);
  });

  test("getPlaceDetails GETs encoded place id", async () => {
    fetchMock.enqueue(googlePlacesDetailsReply());

    const result = await client.getPlaceDetails("user-1", "places/state-bird-sf");

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("expected details success");
    }

    expect(result.data.displayName?.text).toBe(MOCK_VENUE_BUNDLE.displayName?.text);

    const [url, init] = fetchMock.calls[0]!;
    expect(String(url)).toBe("https://places.googleapis.com/v1/places/state-bird-sf");
    expect(init?.method).toBe("GET");
  });

  test("getPlacePhotoUri returns photoUri from media endpoint", async () => {
    fetchMock.enqueue(googlePlacesPhotoReply("https://lh3.googleusercontent.com/hero"));

    const result = await client.getPlacePhotoUri("user-1", "places/state-bird-sf/photos/hero");

    expect(result).toEqual({ ok: true, data: "https://lh3.googleusercontent.com/hero" });

    const [url, init] = fetchMock.calls[0]!;
    expect(String(url)).toContain("/places/state-bird-sf/photos/hero/media");
    expect(String(url)).toContain("skipHttpRedirect=true");
    expect(init?.method).toBe("GET");
  });

  test("returns missing_api_key when env var is unset", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;

    const result = await client.textSearchPlaces("user-1", { textQuery: "Tartine" });

    expect(result).toEqual({ ok: false, error: { code: "missing_api_key" } });
    expect(fetchMock.calls.length).toBe(0);
  });

  test("returns rate_limited when Upstash limit fails", async () => {
    sharedRatelimitLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await client.textSearchPlaces("user-1", { textQuery: "Tartine" });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected rate limit failure");
    }

    expect(result.error.code).toBe("rate_limited");
    expect(fetchMock.calls.length).toBe(0);
  });

  test("maps HTTP failures", async () => {
    fetchMock.enqueue({ status: 503, body: { error: "unavailable" } });

    const result = await client.getPlaceDetails("user-1", "bad-place");

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected HTTP failure");
    }

    expect(result.error).toMatchObject({ code: "http_error", status: 503 });
  });

  test("maps network failures", async () => {
    fetchMock.enqueue({ throwError: new Error("socket hang up") });

    const result = await client.textSearchPlaces("user-1", { textQuery: "Tartine" });

    expect(result).toEqual({
      ok: false,
      error: { code: "network_error", message: "socket hang up" },
    });
  });

  test("googlePlacesErrorMessage covers client error codes", () => {
    expect(client.googlePlacesErrorMessage({ code: "missing_api_key" })).toBe(
      "Google Places API is not configured"
    );
    expect(client.googlePlacesErrorMessage({ code: "rate_limited", message: "Too many" })).toBe(
      "Too many"
    );
    expect(
      client.googlePlacesErrorMessage({ code: "http_error", status: 404, message: "Not found" })
    ).toBe("Google Places request failed (404)");
    expect(client.googlePlacesErrorMessage({ code: "network_error", message: "timeout" })).toBe(
      "Could not reach Google Places"
    );
  });
});
