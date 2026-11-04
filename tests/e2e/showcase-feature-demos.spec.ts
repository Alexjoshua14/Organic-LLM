/**
 * Public feature demos — signed out, zero cost.
 * Covers the guided field trip on /showcase and the five standalone demo pages: they render,
 * stay inside the viewport on mobile, honor reduced motion, make no paid or mutating requests,
 * and never touch the microphone.
 */
import { expect, test, type Page } from "@playwright/test";

const DEMOS = [
  { slug: "rabbit-holes", title: "Rabbit Holes" },
  { slug: "generative-ui", title: "Generative UI" },
  { slug: "voice", title: "Voice" },
  { slug: "context-controls", title: "Context Controls" },
  { slug: "models-and-usage", title: "Model Selection" },
] as const;

/** Root-layout reads that every page makes; demos add nothing to them. */
const ALLOWED_API_GETS = new Set(["/api/ai/speak/realtime/active", "/api/chats"]);

function watchNetwork(page: Page) {
  const violations: string[] = [];
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => {
    let url: URL;

    try {
      url = new URL(request.url());
    } catch {
      return;
    }
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return;
    if (!url.pathname.startsWith("/api/")) return;
    if (request.method() !== "GET" || !ALLOWED_API_GETS.has(url.pathname)) {
      violations.push(`${request.method()} ${url.pathname}`);
    }
  });

  return { violations, errors };
}

async function blockMedia(page: Page) {
  await page.addInitScript(() => {
    const calls: string[] = [];

    (window as unknown as { __mediaCalls: string[] }).__mediaCalls = calls;
    const media = navigator.mediaDevices;

    if (media) {
      media.getUserMedia = () => {
        calls.push("getUserMedia");

        return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      };
    }
    const speech = window.speechSynthesis;

    if (speech) {
      const speak = speech.speak.bind(speech);

      speech.speak = (utterance) => {
        calls.push("speechSynthesis.speak");
        speak(utterance);
      };
    }
  });
}

const mediaCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mediaCalls: string[] }).__mediaCalls);

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => {
    const scroller = document.querySelector(".showcase-scroll") ?? document.documentElement;

    return Math.max(
      document.documentElement.scrollWidth - window.innerWidth,
      scroller.scrollWidth - scroller.clientWidth
    );
  });

test.describe("Showcase field trip (signed out)", () => {
  test("walks five chapters and marks the active one while scrolling", async ({ page }) => {
    const net = watchNetwork(page);

    await blockMedia(page);
    await page.goto("/showcase", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Follow an idea further." })).toBeVisible();
    // The wordmark is stable: it always returns to the homepage, never the showcase.
    await expect(page.locator(".showcase-wordmark")).toHaveAttribute("href", "/");

    const bar = page.getByRole("navigation", { name: "Field trip chapters" });

    await expect(bar.getByRole("link")).toHaveCount(5);
    for (const [index, demo] of DEMOS.entries()) {
      await page.locator(`#trip-${demo.slug}`).evaluate((el) => el.scrollIntoView());
      await expect(bar.getByRole("link").nth(index)).toHaveAttribute("aria-current", "step");
      await expect(
        page.locator(`#trip-${demo.slug}`).getByRole("button", { name: /Pause replay|Play replay/ })
      ).toBeVisible({ timeout: 15_000 });
    }

    expect(await mediaCalls(page)).toEqual([]);
    expect(net.violations).toEqual([]);
    expect(net.errors).toEqual([]);
  });

  test("stays inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/showcase", { waitUntil: "domcontentloaded" });
    for (const demo of DEMOS) {
      await page.locator(`#trip-${demo.slug}`).evaluate((el) => el.scrollIntoView());
      await page.waitForTimeout(400);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    }
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("opens each chapter on its finished state", async ({ page }) => {
      await page.goto("/showcase", { waitUntil: "domcontentloaded" });
      await page.locator("#trip-rabbit-holes").evaluate((el) => el.scrollIntoView());
      await expect(page.getByRole("button", { name: "Next chapter" }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("button", { name: "Pause replay" })).toHaveCount(0);
    });
  });
});

for (const demo of DEMOS) {
  test.describe(`${demo.title} demo page (signed out)`, () => {
    test("loads, labels itself scripted, and makes no paid or mutating requests", async ({
      page,
    }) => {
      const net = watchNetwork(page);

      await blockMedia(page);
      await page.goto(`/showcase/${demo.slug}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: demo.title })).toBeVisible();
      await expect(page.getByText(/fictional data|synthetic|scripted/i).first()).toBeVisible();
      await page.waitForTimeout(6_000);

      expect(await mediaCalls(page)).toEqual([]);
      expect(net.violations).toEqual([]);
      expect(net.errors).toEqual([]);
    });

    test("fits a 390px viewport", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/showcase/${demo.slug}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: demo.title })).toBeVisible();
      await page.waitForTimeout(800);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  });
}

test("Voice demo: audio and transcript", async ({ page }) => {
  await blockMedia(page);
  await page.goto("/showcase/voice", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("YOU").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /waveform audio/i })).toBeVisible();
  expect(await mediaCalls(page)).toEqual([]);
});

test("Generative UI demo: replay builds each block, and the kit list is usable", async ({
  page,
}) => {
  await page.goto("/showcase/generative-ui", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Restart replay" }).click();
  await expect(page.getByLabel("Loading structured response")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText("Where should we go?").first()).toBeVisible({ timeout: 6_000 });
  await expect(
    page.getByRole("group", { name: "Answer format" }).getByRole("button", { name: "Pack the kit" })
  ).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 15_000 }
  );

  const item = page.getByRole("button", { name: "Mark as picked up" }).first();

  await item.click();
  await expect(page.getByRole("button", { name: "Mark as not picked up" }).first()).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("a demo page links back to the showcase", async ({ page }) => {
  await page.goto("/showcase/rabbit-holes", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".showcase-wordmark")).toHaveAttribute("href", "/");
  await page.getByRole("link", { name: "Back to showcase" }).click();
  await expect(page).toHaveURL(/\/showcase$/);
});

test("Model Selection demo: no usage, cost or plan information", async ({ page }) => {
  await page.goto("/showcase/models-and-usage", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Selected model")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  const text = await page.locator("main").innerText();

  expect(text).not.toMatch(/\$\d|est\. cost|plan allotment|free|plus|\bpro\b|tokens over time/i);
});
