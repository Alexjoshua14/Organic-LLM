import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

let bundleDirectory: string;
let javascript: string;
const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:16px system-ui}.app{display:flex;height:700px}
.sidebar-gap{width:0;flex-shrink:0;transition:width 100ms linear;background:#ddd}
[data-sidebar-open=true] .sidebar-gap{width:256px}
.page{flex:1;min-width:0;overflow:hidden;transition:all 150ms}
[data-sidebar-open=true] .page{margin-top:16px;height:calc(100% - 16px);border-top:1px solid #aaa}
.dashboard{height:100%;display:grid;grid-template-columns:minmax(0,7fr) minmax(0,3fr);gap:32px}
.chat-viewport{min-width:0;overflow:hidden}.chat{height:100%;display:flex;flex-direction:column}
p{flex:1}.composer-inset{margin:0 28px 16px}.composer{width:100%;padding:16px;border:1px solid #aaa;border-radius:12px}
textarea{width:100%;resize:none}.controls{display:flex;gap:12px}.send{margin-left:auto}.board{background:#eee}
</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`;

test.beforeAll(() => {
  bundleDirectory = mkdtempSync(join(tmpdir(), "organic-composer-resize-"));
  const outfile = join(bundleDirectory, "fixture.js");
  execFileSync("bun", [
    "build",
    "tests/fixtures/composer-resize-harness.tsx",
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
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith("fixture.js") ? "text/javascript" : "text/html",
      body: route.request().url().endsWith("fixture.js") ? javascript : HTML,
    })
  );
  await page.goto("http://composer-fixture.test");
  await expect(page.locator("[data-composer]")).toBeVisible();
  // Start from a painted layout with the initial ResizeObserver delivery complete.
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
});

test("sidebar CSS transitions never clip the composer controls", async ({ page }) => {
  await page.locator("textarea").focus();

  for (let toggle = 0; toggle < 4; toggle += 1) {
    const result = await page.evaluate(async () => {
      const composer = document.querySelector<HTMLElement>("[data-composer]")!;
      const viewport = document.querySelector<HTMLElement>(".chat-viewport")!;
      let maxClipped = 0;
      let worst: unknown = null;
      const start = performance.now();
      document.querySelector<HTMLButtonElement>("#toggle-sidebar")!.click();
      while (performance.now() - start < 700) {
        await new Promise(requestAnimationFrame);
        const box = composer.getBoundingClientRect();
        const clip = viewport.getBoundingClientRect();
        const clipped = Math.max(0, clip.left - box.left, box.right - clip.right);
        if (clipped > maxClipped) {
          maxClipped = clipped;
          worst = {
            box: { left: box.left, right: box.right, width: box.width },
            clip: { left: clip.left, right: clip.right, width: clip.width },
            transform: composer.style.transform,
            scrollLeft: viewport.scrollLeft,
            parentScroll: composer.parentElement!.scrollLeft,
            animations: document.getAnimations().map((animation) => ({
              property: (animation as CSSTransition).transitionProperty,
              state: animation.playState,
              target: ((animation.effect as KeyframeEffect).target as HTMLElement)?.className,
            })),
          };
        }
      }
      return { maxClipped, worst, transform: composer.style.transform };
    });
    expect(result.maxClipped, JSON.stringify({ toggle, ...result })).toBeLessThanOrEqual(1);
    expect(result.transform).toBe("");
    await expect(page.locator("textarea")).toHaveValue("Unsent draft");
    await expect(page.locator("textarea")).toBeFocused();
  }
});

test("reversing the sidebar mid-transition keeps the composer inside its pane", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const composer = document.querySelector<HTMLElement>("[data-composer]")!;
    const viewport = document.querySelector<HTMLElement>(".chat-viewport")!;
    const toggle = document.querySelector<HTMLButtonElement>("#toggle-sidebar")!;
    const start = performance.now();
    let clicks = 0;
    let maxClipped = 0;
    while (performance.now() - start < 800) {
      if (clicks < 5 && performance.now() - start >= clicks * 40) {
        toggle.click();
        clicks += 1;
      }
      await new Promise(requestAnimationFrame);
      const box = composer.getBoundingClientRect();
      const clip = viewport.getBoundingClientRect();
      maxClipped = Math.max(maxClipped, clip.left - box.left, box.right - clip.right);
    }
    return { clicks, maxClipped, transform: composer.style.transform };
  });
  expect(result.clicks).toBe(5);
  expect(result.maxClipped).toBeLessThanOrEqual(1);
  expect(result.transform).toBe("");
});
