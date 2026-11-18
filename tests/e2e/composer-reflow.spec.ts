import type { Page } from "@playwright/test";

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Compact CoreInput in a real browser engine: the real editor, reflow logic, buttons and the
 * compiled app CSS (tests/fixtures/composer-reflow-harness.tsx), with no app server or account.
 *
 * Guards three regressions:
 * - the one-line ⇄ stacked layouts flapping many times a second at the wrap boundary;
 * - stacking early, while the draft still fits on one line;
 * - squashed (non-square) compact buttons on touch screens.
 * And one behaviour: a tap on the composer's empty space focuses the draft.
 */

let directory: string;
let javascript: string;
let css: string;

const html = () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style>
<style>body{margin:0;padding:16px;font-family:system-ui,sans-serif}</style>
</head><body class="bg-background text-foreground"><div id="root"></div>
<script src="/fixture.js"></script></body></html>`;

test.beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "organic-composer-reflow-"));
  const script = join(directory, "fixture.js");
  const sheet = join(directory, "app.css");

  execFileSync("bun", [
    "tests/fixtures/build-browser-fixture.ts",
    "tests/fixtures/composer-reflow-harness.tsx",
    script,
  ]);
  execFileSync("bun", [
    "tests/fixtures/build-app-css.ts",
    sheet,
    "components/chat/core-input/compact.css",
    "components/chat/core-input/editor/composer-editor.css",
  ]);
  javascript = readFileSync(script, "utf8");
  css = readFileSync(sheet, "utf8");
});

test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const isScript = route.request().url().endsWith("fixture.js");

    return route.fulfill({
      contentType: isScript ? "text/javascript" : "text/html",
      body: isScript ? javascript : html(),
    });
  });
  await page.goto("http://composer-reflow.test");
  await expect(page.locator('[data-row] [role="textbox"]')).toBeVisible();
  // Count every layout change on the row from here on.
  await page.evaluate(() => {
    const row = document.querySelector("[data-row]")!;
    const w = window as unknown as { __flips: number };

    w.__flips = 0;
    new MutationObserver(() => (w.__flips += 1)).observe(row, {
      attributes: true,
      attributeFilter: ["data-expanded"],
    });
  });
});

const frames = (page: Page, count = 2) =>
  page.evaluate(async (n) => {
    for (let i = 0; i < n; i += 1) await new Promise(requestAnimationFrame);
  }, count);

const flips = (page: Page) =>
  page.evaluate(() => (window as unknown as { __flips: number }).__flips);

const stacked = async (page: Page) =>
  (await page.locator("[data-row]").getAttribute("data-expanded")) === "true";

/** The draft's single-line width and the room the one-line layout gives it. */
const lineFit = (page: Page) =>
  page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>('[data-row] [role="textbox"]')!;
    const line = surface.firstElementChild!;
    const range = document.createRange();

    range.selectNodeContents(line);
    const box = range.getBoundingClientRect();
    const style = getComputedStyle(surface);
    const room =
      surface.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    return {
      width: box.width,
      lines: Math.round(box.height / parseFloat(getComputedStyle(line).lineHeight)),
      room,
    };
  });

/** Comfortably past REFLOW_COLLAPSE_SETTLE_MS (350ms), for a busy CI machine. */
const SETTLE_MS = 700;

const DRAFT =
  "Can we make it easier to review a long draft before it goes out, without the composer jumping around while I type?";

async function typeSlowly(page: Page, text: string, afterEach?: () => Promise<void>) {
  for (const character of text) {
    await page.keyboard.type(character);
    await frames(page);
    await afterEach?.();
  }
}

test.describe("phone (touch)", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("typing across the one-line boundary stacks once and then holds still", async ({ page }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    await typeSlowly(page, DRAFT);
    expect(await stacked(page)).toBe(true);
    expect(await flips(page)).toBe(1);
    await page.waitForTimeout(600);
    expect(await flips(page)).toBe(1);
  });

  test("stays on one line while the draft fits, and only stacks once it really wraps", async ({
    page,
  }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    let checkedHalf = false;

    await typeSlowly(page, DRAFT, async () => {
      if (await stacked(page)) return;
      const fit = await lineFit(page);

      // On one line the draft never wraps, and it was never sent to stack while it fit.
      expect(fit.lines).toBe(1);
      if (fit.width >= fit.room / 2) checkedHalf = true;
    });
    expect(checkedHalf).toBe(true);
  });

  test("deleting back returns to one line once, without flapping", async ({ page }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    await typeSlowly(page, DRAFT);
    const before = await flips(page);

    for (let i = 0; i < DRAFT.length; i += 1) {
      await page.keyboard.press("Backspace");
      await frames(page);
    }
    // Returning to one line waits for typing to rest (REFLOW_COLLAPSE_SETTLE_MS).
    await page.waitForTimeout(SETTLE_MS);
    expect(await stacked(page)).toBe(false);
    expect((await flips(page)) - before).toBe(1);
  });

  test("returning to one line waits for typing to rest; stacking does not wait", async ({
    page,
  }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    await typeSlowly(page, DRAFT);
    expect(await stacked(page)).toBe(true);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await frames(page);
    // Fits now, but stays stacked until the pause.
    expect(await stacked(page)).toBe(true);
    await page.waitForTimeout(SETTLE_MS);
    expect(await stacked(page)).toBe(false);
  });

  test("a predictive-text replacement at the boundary never flickers", async ({ page }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    for (const character of DRAFT) {
      await page.keyboard.type(character);
      await frames(page);
      if (await stacked(page)) break;
    }
    const atBoundary = await flips(page);

    // Autocorrect replaces the last word: delete it, then insert the correction, in one burst,
    // several times over (as suggestions are accepted and revised).
    for (let round = 0; round < 4; round += 1) {
      for (let i = 0; i < 6; i += 1) await page.keyboard.press("Backspace");
      await page.keyboard.insertText(round % 2 ? "draftsss" : "drafts");
      await frames(page, 1);
    }
    await page.waitForTimeout(SETTLE_MS);
    expect(await flips(page)).toBe(atBoundary);
  });

  for (const width of [320, 360, 390, 414, 430]) {
    test(`at ${width}px the boundary draft never flaps`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await frames(page, 4);
      await page.locator('[data-row] [role="textbox"]').click();
      // At the narrowest widths the placeholder alone may stack the empty composer; a first
      // word brings it back to one line once typing rests.
      await page.keyboard.type("Can");
      await page.waitForTimeout(SETTLE_MS);
      expect(await stacked(page)).toBe(false);
      // Type on up to the moment it stacks, then leave the draft exactly at the boundary.
      for (const character of DRAFT.slice(3)) {
        await page.keyboard.type(character);
        await frames(page);
        if (await stacked(page)) break;
      }
      expect(await stacked(page)).toBe(true);
      const atBoundary = await flips(page);

      await page.waitForTimeout(600);
      expect(await flips(page)).toBe(atBoundary);
      // One character back across the boundary: at most one change, then still.
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(SETTLE_MS);
      const afterDelete = await flips(page);

      expect(afterDelete - atBoundary).toBeLessThanOrEqual(1);
      await page.waitForTimeout(600);
      expect(await flips(page)).toBe(afterDelete);
    });
  }

  test("the draft fills its row: the whole area on one line, the full row once stacked", async ({
    page,
  }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    await page.keyboard.type("A short thought");
    await frames(page);
    expect(await stacked(page)).toBe(false);
    let fill = await draftFill(page);

    expect(fill.editor).toBeGreaterThanOrEqual(fill.area - 1);
    await typeSlowly(page, ` ${DRAFT}`);
    expect(await stacked(page)).toBe(true);
    fill = await draftFill(page);
    expect(fill.editor).toBeGreaterThanOrEqual(fill.row - 1);
  });

  test("a long draft deleted back to a word or two returns to one line", async ({ page }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    await typeSlowly(page, DRAFT);
    expect(await stacked(page)).toBe(true);
    // A fast burst of deletes, down to "Can we" (fits the one-line room at every phone width).
    for (let i = 0; i < DRAFT.length - 6; i += 1) await page.keyboard.press("Backspace");
    await page.waitForTimeout(SETTLE_MS);
    expect(await stacked(page)).toBe(false);
  });

  test("every compact button is a 44px square target", async ({ page }) => {
    const sizes = await buttonSizes(page);

    for (const [name, size] of Object.entries(sizes)) {
      expect(size.width, `${name} width`).toBeCloseTo(size.height, 0);
      expect(size.width, `${name} target`).toBeGreaterThanOrEqual(44);
    }
  });

  test("a tap on the composer's empty space focuses the draft; a tap on a button does not", async ({
    page,
  }) => {
    const row = await page.locator("[data-row]").boundingBox();
    const area = await page.locator('[data-reflow="area"]').boundingBox();

    // The row's bottom padding, under the draft: empty space, not the text itself.
    await page.touchscreen.tap(area!.x + area!.width / 2, row!.y + row!.height - 2);
    await frames(page);
    expect(await focusedOnDraft(page)).toBe(true);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('[data-reflow="trail"] button').last().tap();
    await frames(page);
    expect(await focusedOnDraft(page)).toBe(false);
  });

  test("the settings panel centres over the composer on xs screens", async ({ page }) => {
    await page.locator('[aria-label="Composer options"]').tap();
    const panel = page.locator(".core-input-options-panel");

    await expect(panel).toBeVisible();
    await frames(page, 4);
    const shell = (await page.locator("[data-prompt-input-shell]").boundingBox())!;
    const box = (await panel.boundingBox())!;

    expect(Math.abs(box.x + box.width / 2 - (shell.x + shell.width / 2))).toBeLessThanOrEqual(1);
  });
});

test.describe("phone keyboard composition (Chromium)", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("an IME composition across the boundary holds the layout until it commits", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "IME composition is driven through the Chromium CDP");
    const cdp = await page.context().newCDPSession(page);

    await page.locator('[data-row] [role="textbox"]').click();
    await page.keyboard.insertText("Short start ");
    await frames(page);
    expect(await stacked(page)).toBe(false);
    const word = "suggestion ".repeat(6);

    // Grow a composition one character at a time, like a predictive keyboard does.
    for (let i = 1; i <= word.length; i += 1) {
      await cdp.send("Input.imeSetComposition", {
        text: word.slice(0, i),
        selectionStart: i,
        selectionEnd: i,
      });
      await frames(page, 1);
    }
    expect(await flips(page)).toBe(0);
    await cdp.send("Input.insertText", { text: word });
    await frames(page, 3);
    expect(await stacked(page)).toBe(true);
    expect(await flips(page)).toBe(1);
  });
});

test.describe("desktop (mouse)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the settings panel keeps to the composer's left edge from sm up", async ({ page }) => {
    await page.locator('[aria-label="Composer options"]').click();
    const panel = page.locator(".core-input-options-panel");

    await expect(panel).toBeVisible();
    await frames(page, 4);
    const shell = (await page.locator("[data-prompt-input-shell]").boundingBox())!;

    expect(Math.abs((await panel.boundingBox())!.x - shell.x)).toBeLessThanOrEqual(1);
  });

  test("icon chips are 32px squares and Send a 36px circle", async ({ page }) => {
    const sizes = await buttonSizes(page);

    for (const [name, size] of Object.entries(sizes)) {
      expect(size.width, `${name} width`).toBeCloseTo(size.height, 0);
    }
    expect(sizes.send.width).toBeCloseTo(36, 0);
    expect(sizes.mic.width).toBeCloseTo(32, 0);
  });

  test("a long draft stacks once and holds still", async ({ page }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    await typeSlowly(page, `${DRAFT} ${DRAFT}`);
    expect(await stacked(page)).toBe(true);
    expect(await flips(page)).toBe(1);
  });
});

function buttonSizes(page: Page) {
  return page.evaluate(() => {
    const size = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();

      return { width: box.width, height: box.height };
    };

    return {
      options: size('[data-reflow="lead"] button'),
      add: size('[data-reflow="trail"] button[aria-haspopup="menu"]'),
      mic: size('[data-reflow="trail"] button[aria-label="Dictate message"]'),
      send: size('[data-reflow="send"] button'),
    };
  });
}

function focusedOnDraft(page: Page) {
  return page.evaluate(
    () => document.activeElement?.closest('[data-row] [role="textbox"]') !== null
  );
}

/** Widths of the editor, its reflow area, and the row's content box (inside its padding). */
function draftFill(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-row]")!;
    const style = getComputedStyle(row);

    return {
      editor: document.querySelector('[data-row] [role="textbox"]')!.getBoundingClientRect().width,
      area: document.querySelector('[data-reflow="area"]')!.getBoundingClientRect().width,
      row: row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    };
  });
}
