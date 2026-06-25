import { expect, test } from "@playwright/test";

const LIQUID_CHROME_PAGE_FILL_CLASS = "page-liquid-chrome";
const LIQUID_CHROME_SSR_FILL_CLASS = "liquid-chrome-page-fill";

const CHROME_ROUTES = [
  { path: "/", name: "home" },
  { path: "/showcase", name: "showcase gateway" },
  { path: "/sandbox/prototypes/glass-fonts", name: "glass fonts prototype" },
] as const;

const FRAME_COUNT = 4;

function expectSsrChromeFill(html: string) {
  expect(
    html.includes(LIQUID_CHROME_PAGE_FILL_CLASS) || html.includes(LIQUID_CHROME_SSR_FILL_CLASS)
  ).toBe(true);
}

test.describe("Liquid chrome first-frame regression", () => {
  for (const route of CHROME_ROUTES) {
    test(`${route.name} SSR includes chrome fill marker`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "commit" });

      expect(response?.ok()).toBeTruthy();

      const html = await response!.text();
      expectSsrChromeFill(html);
    });

    test(`${route.name} keeps chrome fill for first ${FRAME_COUNT} frames`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      const samples = await page.evaluate(async (frameCount) => {
        const selectors = ["section.page-liquid-chrome", ".liquid-chrome-page-fill"];

        const parseRgb = (input: string) => {
          const value = input.trim().toLowerCase();
          if (value === "transparent") return { a: 0, r: 0, g: 0, b: 0 };
          const rgb = value.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
          if (rgb) {
            return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: 1 };
          }
          const rgba = value.match(
            /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/
          );
          if (rgba) {
            return {
              r: Number(rgba[1]),
              g: Number(rgba[2]),
              b: Number(rgba[3]),
              a: Number(rgba[4]),
            };
          }
          return null;
        };

        const isFilled = (backgroundColor: string, backgroundImage: string) => {
          if (backgroundImage && backgroundImage !== "none") return true;
          const rgb = parseRgb(backgroundColor);
          if (!rgb) return backgroundColor !== "transparent";
          if (rgb.a < 0.05) return false;
          if (rgb.r > 250 && rgb.g > 250 && rgb.b > 250) return false;
          return true;
        };

        const results: Array<{
          frame: number;
          selector: string;
          filled: boolean;
          backgroundColor: string;
          backgroundImage: string;
          missing: boolean;
        }> = [];

        for (let frame = 0; frame < frameCount; frame += 1) {
          if (frame > 0) {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          }

          let element: Element | null = null;
          let selector = selectors.join(", ");

          for (const candidate of selectors) {
            const match = document.querySelector(candidate);
            if (match) {
              element = match;
              selector = candidate;
              break;
            }
          }

          if (!element) {
            results.push({
              frame,
              selector,
              filled: false,
              backgroundColor: "transparent",
              backgroundImage: "none",
              missing: true,
            });
            continue;
          }

          const style = window.getComputedStyle(element);
          const backgroundColor = style.backgroundColor;
          const backgroundImage = style.backgroundImage;

          results.push({
            frame,
            selector,
            filled: isFilled(backgroundColor, backgroundImage),
            backgroundColor,
            backgroundImage,
            missing: false,
          });
        }

        return results;
      }, FRAME_COUNT);

      expect(samples).toHaveLength(FRAME_COUNT);
      expect(samples.every((sample) => sample.filled)).toBe(true);
    });
  }
});
