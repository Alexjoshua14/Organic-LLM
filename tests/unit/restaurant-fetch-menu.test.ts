import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createMockFetch } from "../helpers/mock-fetch";
import { MOCK_RESTAURANT_MENU_HTML } from "../helpers/restaurant-menu-html";

describe("fetchRestaurantMenu", () => {
  let fetchMock: ReturnType<typeof createMockFetch>;
  let fetchRestaurantMenu: typeof import("@/lib/restaurant/fetch-menu").fetchRestaurantMenu;

  beforeEach(async () => {
    fetchMock = createMockFetch();
    fetchRestaurantMenu = (await import("@/lib/restaurant/fetch-menu")).fetchRestaurantMenu;
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test("fetches website HTML and parses schema.org menu", async () => {
    fetchMock.enqueue({ bodyText: MOCK_RESTAURANT_MENU_HTML });

    const result = await fetchRestaurantMenu("https://statebirdsf.com/menu");

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("expected menu fetch success");
    }

    expect(result.menu.sections[0]?.name).toBe("Mains");
    expect(result.menu.sections[0]?.items[0]).toMatchObject({
      name: "Burger",
      description: "Grass-fed beef",
      price: "$18",
    });
    expect(result.menu.sourceNote).toBe("From restaurant website");

    const [url, init] = fetchMock.calls[0]!;
    expect(String(url)).toBe("https://statebirdsf.com/menu");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toContain(
      "OrganicLLM-Restaurant"
    );
  });

  test("rejects missing or non-http URLs", async () => {
    expect(await fetchRestaurantMenu(undefined)).toEqual({
      ok: false,
      error: "No website URL",
    });
    expect(await fetchRestaurantMenu("ftp://example.com/menu")).toEqual({
      ok: false,
      error: "No website URL",
    });
    expect(fetchMock.calls.length).toBe(0);
  });

  test("returns HTTP status errors", async () => {
    fetchMock.enqueue({ status: 404, bodyText: "Not found" });

    const result = await fetchRestaurantMenu("https://statebirdsf.com/menu");

    expect(result).toEqual({ ok: false, error: "Fetch failed with status 404" });
  });

  test("returns error when page has no structured menu", async () => {
    fetchMock.enqueue({ bodyText: "<html><body>No JSON-LD here</body></html>" });

    const result = await fetchRestaurantMenu("https://statebirdsf.com/menu");

    expect(result).toEqual({ ok: false, error: "No structured menu found on the page" });
  });

  test("returns error when fetch throws", async () => {
    fetchMock.enqueue({ throwError: new Error("ENOTFOUND") });

    const result = await fetchRestaurantMenu("https://statebirdsf.com/menu");

    expect(result).toEqual({ ok: false, error: "Could not reach the website" });
  });
});
