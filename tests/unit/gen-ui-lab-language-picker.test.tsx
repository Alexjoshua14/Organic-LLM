import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { act, cleanup, fireEvent, within } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import { LANGUAGE_SAMPLES } from "@/app/sandbox/prototypes/_fixtures/language-samples";
import { GEN_UI_LANGUAGE_INTERVAL_MS } from "@/app/sandbox/prototypes/gen-ui-lab/_hooks/use-gen-ui-language-rotation";
import { GenUiLabShell } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiLabShell";
import { buildDefaultBlockMap } from "@/lib/sandbox/gen-ui-lab";

let restoreMedia: () => void;
const originalObserver = globalThis.IntersectionObserver;
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  // Test JSDOM is not "visual", so document.hidden is true and Shuffle would pause as if the tab
  // were in the background.
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  restoreMedia = installBrowserMedia();
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  delete (document as { hidden?: boolean }).hidden;
  jest.useRealTimers();
  cleanup();
  restoreMedia();
  globalThis.IntersectionObserver = originalObserver;
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function renderShell() {
  const view = render(<GenUiLabShell initialBlocks={buildDefaultBlockMap()} />);
  const page = (archetype: string) =>
    view.container.querySelector<HTMLElement>(`[data-archetype="${archetype}"]`)!;

  return { view, page };
}

/** Shuffle runs only on the selected page, as when it is scrolled into view. */
function selectPage(view: ReturnType<typeof renderShell>["view"], name: RegExp) {
  const nav = view.getByRole("navigation", { name: "Gen UI archetypes" });

  fireEvent.click(within(nav).getByRole("button", { name }));
}

/** The code block itself, so a language name in the toolbar is not mistaken for its header. */
const codeBlock = (section: HTMLElement) => section.querySelector<HTMLElement>("[data-wrap]")!;

/** Radix opens its menu on Enter; jsdom has no pointer-capture, so the keyboard is the way in. */
function openLanguageMenu(section: HTMLElement) {
  const trigger = within(section).getByRole("button", { name: /^Language:/ });

  fireEvent.keyDown(trigger, { key: "Enter" });

  return trigger;
}

describe("Code page language picker", () => {
  test("picking a language changes the snippet, its header and the gutter", () => {
    const { view, page } = renderShell();
    const section = page("code-diff");

    expect(within(codeBlock(section)).getByText("TypeScript")).toBeTruthy();
    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Ruby" }));

    expect(within(codeBlock(section)).getByText("Ruby")).toBeTruthy();
    expect(within(codeBlock(section)).queryByText("TypeScript")).toBeNull();
    expect(section.textContent).toContain("class Greeter");
    expect(within(section).getByRole("button", { name: "Language: Ruby" })).toBeTruthy();
  });

  test("the menu lists every supported language", () => {
    const { view, page } = renderShell();

    openLanguageMenu(page("code-diff"));
    expect(view.getAllByRole("menuitemradio").length).toBe(LANGUAGE_SAMPLES.length);
  });

  test("the language controls live on the Snippet and Diff slides only, and the row keeps its space", () => {
    const { page } = renderShell();
    const section = page("code-diff");
    const controls = () => within(section).queryByRole("group", { name: "Language" });
    const next = () =>
      fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));
    const previous = () =>
      fireEvent.click(within(section).getByRole("button", { name: "Previous preset" }));

    expect(controls()).not.toBeNull();
    next();
    expect(within(section).getByText("Diff")).toBeTruthy();
    expect(controls()).not.toBeNull();
    next();
    expect(within(section).getByText("Fixture")).toBeTruthy();
    expect(controls()).toBeNull();
    // The reserved row stays in the toolbar, so the arrows and the preview do not move.
    expect(section.querySelector(".min-h-9")).not.toBeNull();
    previous();
    previous();
    expect(controls()).not.toBeNull();
  });

  test("Shuffle moves to another language at once, then every few seconds, never repeating", () => {
    jest.useFakeTimers();
    const { view, page } = renderShell();
    const section = page("code-diff");

    selectPage(view, /code diff$/i);
    const shuffle = within(section).getByRole("button", { name: "Shuffle" });
    const shown = () => within(section).getByRole("button", { name: /^Language:/ }).textContent;

    expect(shuffle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(shuffle);
    expect(shuffle.getAttribute("aria-pressed")).toBe("true");

    const seen = [shown()];

    for (let step = 0; step < 6; step += 1) {
      act(() => {
        jest.advanceTimersByTime(GEN_UI_LANGUAGE_INTERVAL_MS);
      });
      seen.push(shown());
    }
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(new Set(seen).size).toBeGreaterThan(1);
  });

  test("picking a language by hand stops the shuffle", () => {
    jest.useFakeTimers();
    const { view, page } = renderShell();
    const section = page("code-diff");

    selectPage(view, /code diff$/i);
    const shuffle = within(section).getByRole("button", { name: "Shuffle" });

    fireEvent.click(shuffle);
    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Rust" }));

    expect(shuffle.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      jest.advanceTimersByTime(GEN_UI_LANGUAGE_INTERVAL_MS * 3);
    });
    expect(within(section).getByRole("button", { name: "Language: Rust" })).toBeTruthy();
  });

  test("Shuffle pauses while the pointer is over the code", () => {
    jest.useFakeTimers();
    const { view, page } = renderShell();
    const section = page("code-diff");
    const shown = () => within(section).getByRole("button", { name: /^Language:/ }).textContent;

    selectPage(view, /code diff$/i);
    fireEvent.click(within(section).getByRole("button", { name: "Shuffle" }));
    const before = shown();
    const preview = section.querySelector(".ai-message")!.parentElement!;

    fireEvent.pointerEnter(preview);
    act(() => {
      jest.advanceTimersByTime(GEN_UI_LANGUAGE_INTERVAL_MS * 3);
    });
    expect(shown()).toBe(before);
  });
});

describe("Diff slide language picker", () => {
  test("the same picker drives the diff: its file and its colors follow the language", () => {
    const { view, page } = renderShell();
    const section = page("code-diff");

    fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));
    expect(within(section).getByRole("region", { name: "Diff of lib/subscribe.ts" })).toBeTruthy();

    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Go" }));

    expect(section.textContent).toContain("A small Go change");
    expect(
      within(section).getByRole("region", { name: "Diff of cmd/server/main.go" })
    ).toBeTruthy();
    expect(section.textContent).toContain("ListenAndServe");
    // The diff block found the language from the .go extension.
    expect(section.querySelector(".token.keyword")).not.toBeNull();
  });

  test("a language picked on Snippet carries to Diff, and back", () => {
    const { view, page } = renderShell();
    const section = page("code-diff");

    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Rust" }));
    fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));

    expect(within(section).getByRole("region", { name: "Diff of src/lib.rs" })).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Language: Rust" })).toBeTruthy();
  });

  test("Shuffle rotates the diff through languages without repeating", () => {
    jest.useFakeTimers();
    const { view, page } = renderShell();
    const section = page("code-diff");

    fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));
    selectPage(view, /code diff$/i);
    const shown = () => within(section).getByRole("button", { name: /^Language:/ }).textContent;

    fireEvent.click(within(section).getByRole("button", { name: "Shuffle" }));
    const seen = [shown()];

    for (let step = 0; step < 5; step += 1) {
      act(() => {
        jest.advanceTimersByTime(GEN_UI_LANGUAGE_INTERVAL_MS);
      });
      seen.push(shown());
    }
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(within(section).getByText("Diff")).toBeTruthy();
  });

  test("Shuffle stops when the reader leaves for the Fixture slide", () => {
    jest.useFakeTimers();
    const { view, page } = renderShell();
    const section = page("code-diff");

    selectPage(view, /code diff$/i);
    fireEvent.click(within(section).getByRole("button", { name: "Shuffle" }));
    fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));
    fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));
    expect(within(section).getByText("Fixture")).toBeTruthy();
    expect(
      within(section).getByRole("heading", { level: 3, name: "Retry web search on rate limits" })
    ).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(GEN_UI_LANGUAGE_INTERVAL_MS * 3);
    });
    expect(
      within(section).getByRole("heading", { level: 3, name: "Retry web search on rate limits" })
    ).toBeTruthy();
  });
});
