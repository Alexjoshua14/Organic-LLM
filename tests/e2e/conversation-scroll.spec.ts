import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

let bundleDirectory: string;
let javascript: string;

const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Synthetic conversation scrolling</title><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui;background:#fafafa;color:#202020}
main{height:100dvh;display:flex;flex-direction:column}header,footer{padding:12px 20px;flex-shrink:0}
h1{font-size:16px;margin:0}h2{font-size:18px;margin:0 0 8px}p{margin:0}header span{font-size:12px}
.fixture-conversation{position:relative;display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
.conversation-scroll{overflow:auto;overscroll-behavior-y:contain}
.fixture-content{display:flex;flex-direction:column;gap:24px;padding:32px;max-width:920px;margin:auto}
.nested-reader{height:160px;flex-shrink:0;overflow:auto;overscroll-behavior:contain;border:1px solid #aaa}
.fixture-jump{position:absolute;bottom:20px;left:50%;width:40px;height:40px;border-radius:50%;background:white}
</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`;

test.beforeAll(() => {
  bundleDirectory = mkdtempSync(join(tmpdir(), "organic-scroll-fixture-"));
  const outfile = join(bundleDirectory, "fixture.js");

  execFileSync("bun", [
    "build",
    "tests/fixtures/conversation-scroll-harness.tsx",
    "--target=browser",
    "--define",
    'process.env.NODE_ENV="production"',
    "--outfile",
    outfile,
  ]);
  javascript = readFileSync(outfile, "utf8");
});

test.afterAll(() => {
  if (bundleDirectory) rmSync(bundleDirectory, { recursive: true, force: true });
});

test.beforeEach(async ({ page }) => {
  // Fulfill every request locally. This fresh browser never reads the user's browser profile.
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith("fixture.js") ? "text/javascript" : "text/html",
      body: route.request().url().endsWith("fixture.js") ? javascript : HTML,
    })
  );
  await page.goto("http://scroll-fixture.test");
  await expect(page.locator("[data-paragraph]")).toHaveCount(30);
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
});

function bottomGap(page: Page) {
  return page
    .locator(".conversation-scroll")
    .evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop));
}

function scrollTop(page: Page) {
  return page.locator(".conversation-scroll").evaluate((el) => el.scrollTop);
}

async function startReading(page: Page) {
  const scroller = page.locator(".conversation-scroll");

  // Use the outer gutter so a short viewport cannot put the pointer over a nested reader.
  await scroller.hover({ position: { x: 2, y: 2 } });
  await page.mouse.wheel(0, -700);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
  // Wait for native scrolling to settle; inspect the browser across successive animation frames.
  await scroller.evaluate(async (el) => {
    let previous = el.scrollTop;
    let stable = 0;
    while (stable < 5) {
      await new Promise(requestAnimationFrame);
      const current = el.scrollTop;
      stable = Math.abs(current - previous) < 0.5 ? stable + 1 : 0;
      previous = current;
    }
  });
}

async function visibleParagraph(page: Page) {
  const id = await page.locator(".conversation-scroll").evaluate((el) => {
    const viewport = el.getBoundingClientRect();

    return Array.from(el.querySelectorAll<HTMLElement>("[data-paragraph]"))
      .find((paragraph) => {
        const bounds = paragraph.getBoundingClientRect();

        return bounds.bottom > viewport.top && bounds.top < viewport.bottom;
      })
      ?.getAttribute("data-paragraph");
  });

  expect(id).toBeDefined();

  return page.locator(`[data-paragraph="${id}"]`);
}

async function recordScroll(page: Page) {
  await page.locator(".conversation-scroll").evaluate((el) => {
    const samples: number[] = [];
    (window as unknown as { scrollSamples: number[] }).scrollSamples = samples;
    el.addEventListener("scroll", () => samples.push(el.scrollTop));
  });
}

async function expectInstantArrival(page: Page, from: number) {
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
  const target = await scrollTop(page);
  const samples = await page.evaluate(
    () => (window as unknown as { scrollSamples: number[] }).scrollSamples
  );

  expect(target - from).toBeGreaterThan(100);
  expect(samples.filter((value) => value > from + 2 && value < target - 2)).toEqual([]);
}

test("opens at the latest message without an unnecessary jump control", async ({ page }) => {
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "true");
  await expect(page.locator(".fixture-jump")).toHaveCount(0);
});

test("reading earlier text stays in place while later content streams", async ({
  page,
}, testInfo) => {
  await startReading(page);
  const before = await scrollTop(page);

  await page.evaluate(() => window.scrollFixture.stream());
  await expect(page.locator("[data-paragraph]")).toHaveCount(50);
  await expect(page.locator("#stream-state")).toHaveText("ready");
  await expect.poll(() => scrollTop(page)).toBeCloseTo(before, 0);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
  await page.screenshot({ path: testInfo.outputPath("synthetic-reading-position.png") });
});

test("follows streamed output when the reader remains at the bottom", async ({ page }) => {
  await page.evaluate(() => window.scrollFixture.stream());
  await expect(page.locator("[data-paragraph]")).toHaveCount(50);
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "true");
});

test("the named jump control returns to the bottom and resumes following", async ({ page }) => {
  await startReading(page);
  await page.getByRole("button", { name: "Scroll to latest message" }).click();
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
  await page.evaluate(() => window.scrollFixture.append());
  await expect(page.locator("[data-paragraph]")).toHaveCount(42);
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
});

test("upward input interrupts an automatic journey to the bottom", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "reduced-motion",
    "Instant navigation has no animation to interrupt."
  );
  await startReading(page);
  await page.evaluate(() => window.scrollFixture.append());
  const before = await scrollTop(page);

  await page.locator(".fixture-jump").click();
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 10);
  await page.locator(".conversation-scroll").hover({ position: { x: 2, y: 2 } });
  await page.mouse.wheel(0, -700);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
  await expect.poll(() => bottomGap(page)).toBeGreaterThan(100);
});

test("scrolling a nested reader does not cancel following in its parent", async ({ page }) => {
  const nested = page.locator(".nested-reader");

  await nested.evaluate((el) => {
    el.scrollTop = 200;
  });
  await nested.hover();
  await page.mouse.wheel(0, -100);
  await expect.poll(() => nested.evaluate((el) => el.scrollTop)).toBeLessThan(200);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "true");
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
});

test("late layout growth above the reader preserves the visible paragraph", async ({ page }) => {
  await startReading(page);
  const paragraph = await visibleParagraph(page);
  const before = await paragraph.evaluate((el) => el.getBoundingClientRect().top);

  await page.evaluate(() => window.scrollFixture.growEarlier());
  await expect
    .poll(() => paragraph.evaluate((el) => el.getBoundingClientRect().top))
    .toBeCloseTo(before, 0);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
});

test("composer resizing preserves a detached reading position", async ({ page }) => {
  await startReading(page);
  const before = await scrollTop(page);

  await page.evaluate(() => window.scrollFixture.resizeComposer());
  await expect.poll(() => scrollTop(page)).toBeCloseTo(before, 0);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
});

test("an earlier block collapsing preserves the visible paragraph", async ({ page }) => {
  await page.evaluate(() => window.scrollFixture.growEarlier());
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
  await startReading(page);
  const paragraph = await visibleParagraph(page);
  const before = await paragraph.evaluate((el) => el.getBoundingClientRect().top);

  await page.evaluate(() => window.scrollFixture.collapseEarlier());
  await expect
    .poll(() => paragraph.evaluate((el) => el.getBoundingClientRect().top))
    .toBeCloseTo(before, 0);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
});

test("PageUp lets a keyboard reader leave the latest output", async ({ page }) => {
  const scroller = page.locator(".conversation-scroll");
  const before = await scrollTop(page);

  await scroller.evaluate((el) => {
    el.tabIndex = 0;
    el.focus();
  });
  await scroller.press("PageUp");
  await expect.poll(() => scrollTop(page)).toBeLessThan(before - 100);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
});

test("explicitly disabled initial positioning remains disabled", async ({ page }) => {
  await page.goto("http://scroll-fixture.test?initial=false");
  await expect(page.locator("[data-paragraph]")).toHaveCount(30);
  await expect.poll(() => scrollTop(page)).toBe(0);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "false");
});

test("explicitly disabled resize-following remains disabled", async ({ page }) => {
  await page.goto("http://scroll-fixture.test?resize=false");
  await expect(page.locator("[data-paragraph]")).toHaveCount(30);
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
  const before = await scrollTop(page);

  await page.evaluate(() => window.scrollFixture.append());
  await expect(page.locator("[data-paragraph]")).toHaveCount(42);
  await expect.poll(() => scrollTop(page)).toBeCloseTo(before, 0);
  await expect.poll(() => bottomGap(page)).toBeGreaterThan(100);
});

test("new thread mounts at its own latest message", async ({ page }) => {
  await startReading(page);
  await page.evaluate(() => window.scrollFixture.switchThread());
  await expect.poll(() => bottomGap(page)).toBeLessThanOrEqual(2);
  await expect(page.locator("#follow-state")).toHaveAttribute("data-at-bottom", "true");
});

test("reduced motion makes output-following immediate", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "reduced-motion", "Reduced-motion behavior only.");
  const before = await scrollTop(page);

  await recordScroll(page);
  await page.evaluate(() => window.scrollFixture.append());
  await expect(page.locator("[data-paragraph]")).toHaveCount(42);
  await expectInstantArrival(page, before);
});

test("reduced motion makes deliberate jump-to-latest immediate", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "reduced-motion", "Reduced-motion behavior only.");
  await startReading(page);
  const before = await scrollTop(page);

  await recordScroll(page);
  await page.locator(".fixture-jump").click();
  await expectInstantArrival(page, before);
});

test("reduced motion enabled after mount applies to subsequent following", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const before = await scrollTop(page);

  await recordScroll(page);
  await page.evaluate(() => window.scrollFixture.append());
  await expect(page.locator("[data-paragraph]")).toHaveCount(42);
  await expectInstantArrival(page, before);
});
