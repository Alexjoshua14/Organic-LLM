import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { googlePlacesGatherFetchQueue } from "../helpers/google-places-fetch";
import { createMockFetch } from "../helpers/mock-fetch";
import { registerUpstashRateLimitMocks } from "../helpers/rate-limit-upstash";

mock.module("server-only", () => ({}));

registerUpstashRateLimitMocks();

const ORIGINAL_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

describe("createGatherRestaurantTool", () => {
  let fetchMock: ReturnType<typeof createMockFetch>;
  let createGatherRestaurantTool: typeof import("@/lib/llm/restaurant-tool").createGatherRestaurantTool;

  beforeEach(async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";
    fetchMock = createMockFetch(googlePlacesGatherFetchQueue(4));
    createGatherRestaurantTool = (await import("@/lib/llm/restaurant-tool")).createGatherRestaurantTool;
  });

  afterEach(() => {
    fetchMock.restore();

    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
      process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_API_KEY;
    }
  });

  test("returns a resolved restaurant-card block", async () => {
    const tool = createGatherRestaurantTool({ sbUserId: "user-abc" });
    const result = await tool.execute!(
      { name: "State Bird Provisions", city: "San Francisco" },
      { toolCallId: "tc-gather", messages: [] }
    );

    expect(result.status).toBe("resolved");

    if (result.status !== "resolved") {
      throw new Error("expected resolved venue");
    }

    expect(result.block.type).toBe("restaurant-card");
    expect(result.block.name).toBe("State Bird Provisions");
    expect(String(fetchMock.calls[0]![0])).toContain("/places:searchText");
  });

  test("passes through ambiguous and error results", async () => {
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

    const tool = createGatherRestaurantTool({ sbUserId: "user-abc" });
    const ambiguous = await tool.execute!({ name: "Tartine" }, { toolCallId: "tc-1", messages: [] });

    expect(ambiguous.status).toBe("ambiguous");

    fetchMock.restore();
    fetchMock = createMockFetch([{ body: { places: [] } }]);

    const error = await tool.execute!({ name: "Missing Place" }, { toolCallId: "tc-2", messages: [] });

    expect(error).toEqual({
      status: "error",
      error: 'Could not find "Missing Place"',
    });
  });
});
