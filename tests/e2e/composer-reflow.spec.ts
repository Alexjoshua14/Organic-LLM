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

/** Longer than an animated (smooth) wheel scroll takes to land, as WebKit's does. */
const SCROLL_SETTLE_MS = 400;

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
    // One fast burst of deletes (WebKit has no select-all shortcut here).
    for (let i = 0; i < DRAFT.length; i += 1) await page.keyboard.press("Backspace");
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
    // Short enough for one line in any font. Without Satoshi (CI) the placeholder alone may
    // stack the empty composer; the word brings it back once typing rests.
    await page.keyboard.type("A thought");
    await page.waitForTimeout(SETTLE_MS);
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
    // The attach button: the mic would start dictation, which WebKit blocks on.
    await page.locator('[data-reflow="trail"] button').first().tap();
    await frames(page);
    expect(await focusedOnDraft(page)).toBe(false);
  });

  test("leaving the app and coming back returns focus to the draft", async ({ page }) => {
    await page.locator('[data-row] [role="textbox"]').click();
    await page.keyboard.type("Half a thought");
    // Switching apps: the page hides and the editor loses focus; then the page returns.
    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { value, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        if (value === "hidden") (document.activeElement as HTMLElement | null)?.blur();
      }, state);

    await setVisibility("hidden");
    expect(await focusedOnDraft(page)).toBe(false);
    await setVisibility("visible");
    await frames(page);
    expect(await focusedOnDraft(page)).toBe(true);
    // The caret is back where it was: typing continues the draft.
    await page.keyboard.type("!");
    await expect(page.locator('[data-row] [role="textbox"]')).toHaveText("Half a thought!");
  });

  test("a draft changed from outside (dictation) continues after the new text", async ({
    page,
  }) => {
    const draft = page.locator('[data-row] [role="textbox"]');

    await draft.click();
    await page.keyboard.type("abc");
    await page.keyboard.press("Home");
    await page.evaluate(() =>
      (window as unknown as { __setText: (value: string) => void }).__setText("Dictated words")
    );
    await expect(draft).toHaveText("Dictated words");
    await page.keyboard.type("!");
    await expect(draft).toHaveText("Dictated words!");
  });

  test("a new placeholder (a /btw side question) shows, labels the draft and is measured", async ({
    page,
  }) => {
    const draft = page.locator('[data-row] [role="textbox"]');
    const line = draft.locator("p").first();

    await expect(line).toHaveAttribute("data-placeholder", "Drop a thought");
    await page.evaluate(() =>
      (window as unknown as { __setPlaceholder: (value: string) => void }).__setPlaceholder(
        "Ask a side question…"
      )
    );
    await expect(line).toHaveAttribute("data-placeholder", "Ask a side question…");
    await expect(draft).toHaveAttribute("aria-label", "Ask a side question…");
    // A placeholder far too long for one line stacks the empty composer.
    await page.evaluate(() =>
      (window as unknown as { __setPlaceholder: (value: string) => void }).__setPlaceholder(
        "Ask anything about this thread without adding it to the conversation"
      )
    );
    await expect(page.locator("[data-row]")).toHaveAttribute("data-expanded", "true");
  });

  test("a draft that was not focused stays unfocused when the app returns", async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await frames(page);
    expect(await focusedOnDraft(page)).toBe(false);
  });

  test("the slash menu opens over the whole composer, like the settings panel", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.body.style.paddingTop = "600px";
    });
    await page.locator('[data-row] [role="textbox"]').click();
    await page.keyboard.type("/");
    const menu = page.locator('[role="listbox"][aria-label="Slash commands"]');

    await expect(menu).toBeVisible();
    await frames(page, 4);
    const shell = (await page.locator("[data-prompt-input-shell]").boundingBox())!;
    const box = (await menu.boundingBox())!;
    const area = (await page.locator('[data-reflow="area"]').boundingBox())!;

    // Wider than the draft's one-line column, as wide as the settings panel, centred on xs.
    expect(box.width).toBeGreaterThan(area.width);
    expect(box.width).toBeCloseTo(Math.min(340, 375 - 32), 0);
    expect(Math.abs(box.x + box.width / 2 - (shell.x + shell.width / 2))).toBeLessThanOrEqual(1);
    // No option label wraps onto a second line.
    const wrapped = await menu
      .locator('[role="option"] > span > span:first-child')
      .evaluateAll((labels) =>
        labels.some(
          (label) =>
            label.getBoundingClientRect().height >
            parseFloat(getComputedStyle(label).lineHeight) * 1.5
        )
      );

    expect(wrapped).toBe(false);
    // The caret stays in the draft, so typing filters the menu.
    await page.keyboard.type("num");
    await expect(menu.getByRole("option")).toHaveCount(1);
  });

  test("a slash command wears the warm accent, with its completion muted after the caret", async ({
    page,
  }) => {
    const draft = page.locator('[data-row] [role="textbox"]');
    const token = draft.locator(".composer-slash-token");
    const ghost = draft.locator(".composer-slash-ghost");
    const accent = await page.evaluate(() => {
      const probe = document.createElement("span");

      probe.style.color = "var(--accent-warm)";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;

      probe.remove();

      return color;
    });

    await draft.click();
    await page.keyboard.type("/b");
    await expect(token).toHaveText("/b");
    await expect(ghost).toHaveText("tw");
    expect(await token.evaluate((el) => getComputedStyle(el).color)).toBe(accent);
    // The ghost is the muted variant: the same hue, partly transparent.
    expect(await ghost.evaluate((el) => getComputedStyle(el).color)).not.toBe(accent);
    // Tab accepts; a surface command keeps the accent until it is sent.
    await page.keyboard.press("Tab");
    await expect(draft).toHaveText("/btw ");
    await expect(token).toHaveText("/btw");
    await expect(ghost).toHaveCount(0);
    await page.keyboard.type("what does this mean?");
    await expect(token).toHaveText("/btw");
    // A Markdown command is accented while typed, then becomes its block.
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    for (let i = 0; i < 30; i += 1) await page.keyboard.press("Backspace");
    await page.keyboard.type("/nu");
    await expect(ghost).toHaveText("mbered");
    await page.keyboard.press("Enter");
    await expect(token).toHaveCount(0);
    await expect(draft.locator("ol")).toHaveCount(1);
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

  test("scrolling over CoreInput and its slash menu never scrolls the page", async ({ page }) => {
    // A page that can scroll both ways, and little room above the composer, so the menu (capped
    // at the room it has, like the settings panel) has to scroll.
    await page.evaluate(() => {
      document.body.style.paddingTop = "520px";
      document.body.style.minHeight = "300vh";
      window.scrollTo(0, 300);
    });
    await page.locator('[data-row] [role="textbox"]').click();
    await page.keyboard.type("/");
    const menu = page.locator('[role="listbox"][aria-label="Slash commands"]');

    await expect(menu).toBeVisible();
    await expect(menu.getByRole("group")).toHaveCount(2);
    await expect(menu.getByRole("group").first()).toContainText("Commands");
    await expect(menu.getByRole("group").last()).toContainText("Markdown");
    const scrollY = () => page.evaluate(() => window.scrollY);
    const before = await scrollY();
    const box = (await menu.boundingBox())!;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Down past the menu's end, then up past its start: the menu scrolls, the page never does.
    // WebKit animates wheel scrolling, so wait for the menu to arrive, then give a page scroll
    // (which must not happen) the same time to show up.
    const menuTop = () => menu.evaluate((el) => el.scrollTop);

    for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, 200);
    await expect.poll(menuTop).toBeGreaterThan(0);
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    expect(await scrollY()).toBe(before);
    for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -200);
    await expect.poll(menuTop).toBe(0);
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    expect(await scrollY()).toBe(before);
    // Over the composer itself (a short draft that does not scroll), the page stays put too.
    await page.keyboard.press("Escape");
    const row = (await page.locator("[data-row]").boundingBox())!;

    await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2);
    await page.mouse.wheel(0, 300);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    expect(await scrollY()).toBe(before);
  });

  test("arrow keys keep the active slash command in view inside the menu", async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.paddingTop = "600px";
    });
    await page.locator('[data-row] [role="textbox"]').click();
    await page.keyboard.type("/");
    const menu = page.locator('[role="listbox"][aria-label="Slash commands"]');

    await expect(menu).toBeVisible();
    const scrollY = await page.evaluate(() => window.scrollY);

    for (let i = 0; i < 7; i += 1) await page.keyboard.press("ArrowDown");
    await frames(page);
    const inView = await menu.evaluate((el) => {
      const option = el.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
      const box = el.getBoundingClientRect();

      return option.top >= box.top - 1 && option.bottom <= box.bottom + 1;
    });

    expect(inView).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

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
