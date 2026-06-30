import { describe, expect, test } from "bun:test";

import {
  findLiquidChromeFillElement,
  isLiquidChromeBackgroundFilled,
  parseCssRgb,
  ssrHtmlIncludesChromeFill,
  ssrHtmlLacksChromeFill,
} from "@/lib/background/liquid-chrome-render-guard";

import { installTestJsdom } from "../helpers/install-test-jsdom";

describe("liquid-chrome-render-guard", () => {
  test("parseCssRgb handles rgb and rgba", () => {
    expect(parseCssRgb("rgb(8, 13, 18)")).toEqual({ r: 8, g: 13, b: 18, a: 1 });
    expect(parseCssRgb("rgba(255, 255, 255, 0)")).toEqual({ r: 255, g: 255, b: 255, a: 0 });
    expect(parseCssRgb("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  test("treats radial gradients as filled", () => {
    expect(
      isLiquidChromeBackgroundFilled({
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "radial-gradient(ellipse 120% 80% at 50% 40%, rgb(8, 13, 18), rgb(5, 8, 11))",
      })
    ).toBe(true);
  });

  test("rejects transparent and near-white flashes", () => {
    expect(
      isLiquidChromeBackgroundFilled({
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
      })
    ).toBe(false);

    expect(
      isLiquidChromeBackgroundFilled({
        backgroundColor: "rgb(255, 255, 255)",
        backgroundImage: "none",
      })
    ).toBe(false);
  });

  test("accepts opaque chrome-like rgb fills", () => {
    expect(
      isLiquidChromeBackgroundFilled({
        backgroundColor: "rgb(8, 13, 18)",
        backgroundImage: "none",
      })
    ).toBe(true);
  });

  test("ssrHtmlIncludesChromeFill detects Page class or fixed fill div", () => {
    expect(ssrHtmlIncludesChromeFill('<section class="page-liquid-chrome"></section>')).toBe(true);
    expect(ssrHtmlIncludesChromeFill('<div class="liquid-chrome-page-fill"></div>')).toBe(true);
    expect(ssrHtmlIncludesChromeFill('<main class="app-shell bg-background"></main>')).toBe(false);
  });

  test("ssrHtmlLacksChromeFill is the inverse", () => {
    expect(ssrHtmlLacksChromeFill('<main class="app-shell"></main>')).toBe(true);
    expect(ssrHtmlLacksChromeFill('<div class="liquid-chrome-page-fill"></div>')).toBe(false);
  });

  test("findLiquidChromeFillElement prefers section.page-liquid-chrome over fixed fill", () => {
    installTestJsdom();
    document.documentElement.innerHTML = `
      <body>
        <div class="liquid-chrome-page-fill"></div>
        <section class="page-liquid-chrome app-shell"></section>
      </body>
    `;

    const match = findLiquidChromeFillElement();

    expect(match?.selector).toBe("section.page-liquid-chrome");
    document.documentElement.innerHTML = "";
  });
});
