import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup } from "@testing-library/react";

mock.module("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { createRenderGenUiTool } from "@/lib/llm/gen-ui-tool";
import { googlePlacesGatherFetchQueue, createGooglePlacesAndMenuFetchMock } from "../helpers/google-places-fetch";
import { createMockFetch } from "../helpers/mock-fetch";
import { registerUpstashRateLimitMocks } from "../helpers/rate-limit-upstash";
import { render } from "../helpers/render";

mock.module("server-only", () => ({}));

registerUpstashRateLimitMocks();

const ORIGINAL_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

afterEach(() => cleanup());

describe("restaurant gather → render_gen_ui flow", () => {
  let fetchMock: ReturnType<typeof createMockFetch>;
  let gatherRestaurant: typeof import("@/lib/restaurant/gather-restaurant").gatherRestaurant;
  let createGatherRestaurantTool: typeof import("@/lib/llm/restaurant-tool").createGatherRestaurantTool;

  beforeEach(async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-google-places-key";
    const routed = createGooglePlacesAndMenuFetchMock(4);
    fetchMock = createMockFetch([], { route: (url) => routed.route(url) });
    gatherRestaurant = (await import("@/lib/restaurant/gather-restaurant")).gatherRestaurant;
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

  test("gather_restaurant output passes through render_gen_ui and renders in chat UI", async () => {
    const gatherTool = createGatherRestaurantTool({ sbUserId: "user-flow" });
    const gatherResult = await gatherTool.execute!(
      { name: "State Bird Provisions", city: "San Francisco" },
      { toolCallId: "tc-gather", messages: [] }
    );

    expect(gatherResult.status).toBe("resolved");

    if (gatherResult.status !== "resolved") {
      throw new Error("expected resolved gather result");
    }

    const renderTool = createRenderGenUiTool();
    const renderResult = await renderTool.execute!(
      { block: gatherResult.block },
      { toolCallId: "tc-render", messages: [] }
    );

    expect(renderResult.block.type).toBe("restaurant-card");
    expect(renderResult.block.name).toBe("State Bird Provisions");

    const { getByText } = render(
      <GenUIRenderer data={{ block: renderResult.block }} messageId="flow-1" />
    );

    expect(getByText("State Bird Provisions")).toBeTruthy();
    expect(getByText(/1\.5k reviews/)).toBeTruthy();
  });

  test("direct gatherRestaurant matches tool wrapper output shape", async () => {
    const installFetch = () => {
      const routed = createGooglePlacesAndMenuFetchMock(4);
      return createMockFetch([], { route: (url) => routed.route(url) });
    };

    fetchMock.restore();
    fetchMock = installFetch();
    const direct = await gatherRestaurant("user-flow", {
      name: "State Bird Provisions",
      city: "San Francisco",
    });

    fetchMock.restore();
    fetchMock = installFetch();
    const tool = createGatherRestaurantTool({ sbUserId: "user-flow" });
    const viaTool = await tool.execute!(
      { name: "State Bird Provisions", city: "San Francisco" },
      { toolCallId: "tc-gather-2", messages: [] }
    );

    expect(viaTool).toEqual(direct);
  });
});
