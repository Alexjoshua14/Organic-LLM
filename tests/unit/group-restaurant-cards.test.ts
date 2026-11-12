import { describe, expect, test } from "bun:test";

import {
  classifyPartForRestaurantGrouping,
  groupAdjacentRestaurantCards,
  planRestaurantCardRendering,
  tokensForRestaurantGrouping,
  type RestaurantGroupingToken,
} from "@/components/chat/gen-ui/blocks/restaurant-card/group-restaurant-cards";
import { FIXTURE_RESTAURANT_CARD } from "@/lib/schemas/gen-ui/fixtures";
import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

const cardA = FIXTURE_RESTAURANT_CARD as RestaurantCardBlock;
const cardB: RestaurantCardBlock = {
  ...cardA,
  name: "Tartine Manufactory",
  heroImage: {
    ...cardA.heroImage,
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
  },
};
const cardC: RestaurantCardBlock = {
  ...cardA,
  name: "Zuni Café",
  heroImage: {
    ...cardA.heroImage,
    url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
  },
};

describe("groupAdjacentRestaurantCards", () => {
  test("one restaurant → single", () => {
    const tokens: RestaurantGroupingToken[] = [
      { kind: "restaurant", partIndex: 2, block: cardA },
    ];

    expect(groupAdjacentRestaurantCards(tokens)).toEqual([
      { type: "single", partIndex: 2, block: cardA },
    ]);
  });

  test("two or more adjacent restaurants → one carousel", () => {
    const tokens: RestaurantGroupingToken[] = [
      { kind: "transparent" },
      { kind: "restaurant", partIndex: 1, block: cardA },
      { kind: "transparent" },
      { kind: "restaurant", partIndex: 3, block: cardB },
      { kind: "restaurant", partIndex: 4, block: cardC },
    ];

    expect(groupAdjacentRestaurantCards(tokens)).toEqual([
      {
        type: "carousel",
        partIndices: [1, 3, 4],
        blocks: [cardA, cardB, cardC],
      },
    ]);
  });

  test("non-adjacent restaurants stay separate", () => {
    const tokens: RestaurantGroupingToken[] = [
      { kind: "restaurant", partIndex: 0, block: cardA },
      { kind: "opaque" },
      { kind: "restaurant", partIndex: 2, block: cardB },
    ];

    expect(groupAdjacentRestaurantCards(tokens)).toEqual([
      { type: "single", partIndex: 0, block: cardA },
      { type: "single", partIndex: 2, block: cardB },
    ]);
  });

  test("planRestaurantCardRendering indexes carousel starts and absorbed parts", () => {
    const tokens: RestaurantGroupingToken[] = [
      { kind: "restaurant", partIndex: 1, block: cardA },
      { kind: "restaurant", partIndex: 2, block: cardB },
      { kind: "opaque" },
      { kind: "restaurant", partIndex: 4, block: cardC },
    ];
    const plan = planRestaurantCardRendering(tokens);

    expect(plan.carouselsByStartIndex.get(1)?.partIndices).toEqual([1, 2]);
    expect(plan.carouselsByStartIndex.has(4)).toBe(false);
    expect(plan.carouselPartIndices.has(1)).toBe(true);
    expect(plan.carouselPartIndices.has(2)).toBe(true);
    expect(plan.carouselPartIndices.has(4)).toBe(false);
  });
});

describe("tokensForRestaurantGrouping", () => {
  test("completed gather_restaurant is transparent; completed restaurant render_gen_ui is restaurant", () => {
    const parts = [
      {
        type: "dynamic-tool",
        toolName: "gather_restaurant",
        toolCallId: "g1",
        state: "output-available",
        output: { status: "resolved", block: cardA },
      },
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId: "r1",
        state: "output-available",
        output: { block: cardA },
      },
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId: "r2",
        state: "output-available",
        output: { block: cardB },
      },
    ];

    const tokens = tokensForRestaurantGrouping(parts);

    expect(tokens[0]).toEqual({ kind: "transparent" });
    expect(tokens[1]).toEqual({ kind: "restaurant", partIndex: 1, block: cardA });
    expect(tokens[2]).toEqual({ kind: "restaurant", partIndex: 2, block: cardB });
    expect(groupAdjacentRestaurantCards(tokens)[0]?.type).toBe("carousel");
  });

  test("text between restaurant cards breaks the run", () => {
    const parts = [
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId: "r1",
        state: "output-available",
        output: { block: cardA },
      },
      { type: "text", text: "Or try this one:" },
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId: "r2",
        state: "output-available",
        output: { block: cardB },
      },
    ];

    expect(groupAdjacentRestaurantCards(tokensForRestaurantGrouping(parts))).toEqual([
      { type: "single", partIndex: 0, block: cardA },
      { type: "single", partIndex: 2, block: cardB },
    ]);
  });

  test("trail chrome marks a part opaque even when the tool is gather_restaurant", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "gather_restaurant",
      toolCallId: "g1",
      state: "output-available",
      output: { status: "resolved", block: cardA },
    };

    expect(classifyPartForRestaurantGrouping(part)).toEqual({ kind: "transparent" });
    expect(classifyPartForRestaurantGrouping(part, { rendersChrome: true })).toEqual({
      kind: "opaque",
    });
  });
});
