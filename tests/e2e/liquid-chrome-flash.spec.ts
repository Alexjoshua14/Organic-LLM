/**
 * Liquid chrome first-frame regression (Playwright).
 *
 * Covered: SSR fill markers on opt-in routes, filled backgrounds for first N frames.
 * Not covered here (manual or future): Ergon auth + cookie off, dark-mode toggle mid-load,
 * WebGL handoff timing after AdaptiveLiquidChrome mounts.
 */
import { expect, test } from "@playwright/test";

import {
  assertFramesFilled,
  sampleLiquidChromeFramesInPage,
  ssrHtmlIncludesChromeFill,
  ssrHtmlLacksChromeFill,
} from "./helpers/liquid-chrome-flash";

const CHROME_ROUTES = [
  { path: "/", name: "home" },
  { path: "/showcase", name: "showcase gateway" },
  { path: "/status", name: "status" },
  { path: "/sandbox/prototypes/glass-fonts", name: "glass fonts prototype" },
] as const;

const NON_CHROME_ROUTES = [{ path: "/sandbox/tasks", name: "sandbox tasks" }] as const;

const FRAME_COUNT = 4;

test.describe("Liquid chrome first-frame regression", () => {
  for (const route of CHROME_ROUTES) {
    test(`${route.name} SSR includes chrome fill marker`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "commit" });

      expect(response?.ok()).toBeTruthy();
      expect(ssrHtmlIncludesChromeFill(await response!.text())).toBe(true);
    });

    test(`${route.name} keeps chrome fill for first ${FRAME_COUNT} frames`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      const samples = await page.evaluate(sampleLiquidChromeFramesInPage, FRAME_COUNT);

      expect(samples).toHaveLength(FRAME_COUNT);
      expect(samples.every((sample) => sample.filled)).toBe(true);
      assertFramesFilled(samples);
    });
  }

  for (const route of NON_CHROME_ROUTES) {
    test(`${route.name} SSR omits chrome fill marker`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "commit" });

      expect(response?.ok()).toBeTruthy();
      expect(ssrHtmlLacksChromeFill(await response!.text())).toBe(true);
    });
  }
});
