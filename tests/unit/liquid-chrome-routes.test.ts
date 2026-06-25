import { describe, expect, test } from "bun:test";

import { isLiquidChromeRoutePath } from "@/lib/background/liquid-chrome-routes";

describe("liquid-chrome-routes", () => {
  test("matches home and showcase routes", () => {
    expect(isLiquidChromeRoutePath("/")).toBe(true);
    expect(isLiquidChromeRoutePath("/showcase")).toBe(true);
    expect(isLiquidChromeRoutePath("/showcase/anatomy")).toBe(true);
    expect(isLiquidChromeRoutePath("/sandbox/prototypes/glass-fonts")).toBe(true);
    expect(isLiquidChromeRoutePath("/ergon")).toBe(true);
  });

  test("excludes non-chrome routes", () => {
    expect(isLiquidChromeRoutePath("/blog")).toBe(false);
    expect(isLiquidChromeRoutePath("/chat/abc")).toBe(false);
  });
});
