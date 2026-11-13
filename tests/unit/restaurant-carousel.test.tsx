import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import * as useMobile from "@/hooks/use-mobile";

import { installBrowserMedia } from "../helpers/browser-media";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

const restoreUseMobile = mockModulePreservingReal("@/hooks/use-mobile", useMobile, {
  useIsMobile: () => false,
});
const restoreMedia = installBrowserMedia();

afterAll(() => {
  restoreUseMobile();
  restoreMedia();
});

import { RestaurantCarousel } from "@/components/chat/gen-ui/blocks/restaurant-card/RestaurantCarousel";
import { FIXTURE_RESTAURANT_CARD } from "@/lib/schemas/gen-ui/fixtures";
import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

const cardA = FIXTURE_RESTAURANT_CARD as RestaurantCardBlock;
const cardB: RestaurantCardBlock = {
  ...cardA,
  name: "Tartine Manufactory",
  heroImage: {
    ...cardA.heroImage,
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    alt: "Tartine Manufactory",
  },
};

afterEach(() => cleanup());

describe("RestaurantCarousel", () => {
  test("exposes carousel labels and position indicator", () => {
    const { getByRole, getByText, getByLabelText } = render(
      <RestaurantCarousel blocks={[cardA, cardB]} />
    );

    expect(getByRole("region", { name: /Restaurant results/i })).toBeTruthy();
    expect(getByText("1 of 2")).toBeTruthy();
    expect(getByLabelText(/1 of 2: State Bird Provisions/i)).toBeTruthy();
    expect(getByLabelText(/2 of 2: Tartine Manufactory/i)).toBeTruthy();
    expect(getByRole("button", { name: /Previous restaurant/i })).toBeTruthy();
    expect(getByRole("button", { name: /Next restaurant/i })).toBeTruthy();
  });

  test("arrow keys on the navigation toolbar scroll between slides", () => {
    const scrollToCalls: Array<{ left: number }> = [];

    const { getByRole } = render(<RestaurantCarousel blocks={[cardA, cardB]} />);
    const toolbar = getByRole("toolbar", { name: /Restaurant carousel navigation/i });

    const originalScrollTo = Element.prototype.scrollTo;

    Element.prototype.scrollTo = function scrollToMock(
      this: Element,
      arg?: ScrollToOptions | number
    ) {
      if (typeof arg === "object" && arg && "left" in arg) {
        scrollToCalls.push({ left: Number(arg.left ?? 0) });
      }
    };

    try {
      toolbar.focus();
      fireEvent.keyDown(toolbar, { key: "ArrowRight" });
      expect(scrollToCalls.length).toBeGreaterThan(0);

      fireEvent.keyDown(toolbar, { key: "ArrowLeft" });
      expect(scrollToCalls.length).toBeGreaterThan(1);
    } finally {
      Element.prototype.scrollTo = originalScrollTo;
    }
  });

  test("next button is enabled and previous is disabled on the first slide", () => {
    const { getByRole } = render(<RestaurantCarousel blocks={[cardA, cardB]} />);
    const prev = getByRole("button", { name: /Previous restaurant/i });
    const next = getByRole("button", { name: /Next restaurant/i });

    expect((prev as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  test("single block falls back to a lone card without carousel chrome", () => {
    const { queryByRole, getByText } = render(<RestaurantCarousel blocks={[cardA]} />);

    expect(queryByRole("region", { name: /Restaurant results/i })).toBeNull();
    expect(getByText(cardA.name)).toBeTruthy();
  });
});
