import { describe, expect, mock, test, afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

mock.module("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GenUISkeleton } from "@/components/chat/gen-ui/GenUISkeleton";
import { render } from "../helpers/render";
import {
  FIXTURE_ANSWER_CARD,
  FIXTURE_INVALID_BLOCK,
} from "@/lib/schemas/gen-ui/fixtures";
import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

afterEach(() => cleanup());

describe("GenUIRenderer", () => {
  test("renders answer card for valid tool output", () => {
    const { getByText } = render(
      <GenUIRenderer data={{ block: FIXTURE_ANSWER_CARD }} messageId="t1" />
    );
    expect(getByText(FIXTURE_ANSWER_CARD.tldr)).toBeTruthy();
    expect(getByText(/Summary/)).toBeTruthy();
  });

  test("falls back to markdown for invalid block", () => {
    const { getByText } = render(<GenUIRenderer data={FIXTURE_INVALID_BLOCK} messageId="t2" />);
    expect(getByText(/Bad version|structured block/i)).toBeTruthy();
  });

  test("renders restaurant card condensed view", () => {
    const block: RestaurantCardBlock = {
      type: "restaurant-card",
      version: 1,
      name: "State Bird Provisions",
      storeType: "fine_dining",
      heroImage: {
        url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
        alt: "State Bird Provisions exterior",
      },
      rating: {
        average: 4.6,
        reviewCount: 1520,
        sources: [{ name: "google", rating: 4.6, reviewCount: 1520 }],
      },
    };

    const { getByText } = render(<GenUIRenderer data={{ block }} messageId="t3" />);
    expect(getByText(block.name)).toBeTruthy();
    expect(getByText(/1\.5k reviews/)).toBeTruthy();
  });
});

describe("GenUISkeleton", () => {
  test("streaming partial shows skeleton with type label", () => {
    const { getByLabelText } = render(
      <GenUISkeleton
        partialInput={{ type: "plan-timeline", title: "Loading plan" }}
        type="plan-timeline"
      />
    );
    expect(getByLabelText(/Loading structured response/i)).toBeTruthy();
  });
});
