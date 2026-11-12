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
    const section = page("code-block");

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

    openLanguageMenu(page("code-block"));
    expect(view.getAllByRole("menuitemradio").length).toBe(LANGUAGE_SAMPLES.length);
  });

  test("choosing a language from another slide brings the Snippet slide up", () => {
    const { view, page } = renderShell();
    const section = page("code-block");

    fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));
    expect(within(section).getByText("Reference")).toBeTruthy();

    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Go" }));

    expect(within(section).getByText("Snippet")).toBeTruthy();
    expect(section.textContent).toContain("http.ListenAndServe");
  });

  test("Shuffle moves to another language at once, then every few seconds, never repeating", () => {
    jest.useFakeTimers();
    const { view, page } = renderShell();
    const section = page("code-block");

    selectPage(view, /code block$/i);
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
    const section = page("code-block");

    selectPage(view, /code block$/i);
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
    const section = page("code-block");
    const shown = () => within(section).getByRole("button", { name: /^Language:/ }).textContent;

    selectPage(view, /code block$/i);
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

describe("Code diff page language picker", () => {
  test("opens on the default fixture; picking a language swaps in that language's diff", () => {
    const { view, page } = renderShell();
    const section = page("code-diff");

    expect(within(section).getByRole("button", { name: "Language: Default fixture" })).toBeTruthy();
    expect(section.textContent).not.toContain("cmd/server/main.go");

    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Go" }));

    expect(section.textContent).toContain("A small Go change");
    expect(section.textContent).toContain("main.go");
    expect(section.textContent).toContain("ListenAndServe");
    // The diff block colors it: the language was found from the .go extension.
    expect(section.querySelector(".token.keyword")).not.toBeNull();
  });

  test("Default fixture returns the page's own content", () => {
    const { view, page } = renderShell();
    const section = page("code-diff");
    const original = section.textContent;

    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Go" }));
    expect(section.textContent).not.toBe(original);

    openLanguageMenu(section);
    fireEvent.click(view.getByRole("menuitemradio", { name: "Default fixture" }));
    expect(section.textContent).toBe(original);
  });

  test("Shuffle rotates the diff through languages without repeating", () => {
    jest.useFakeTimers();
    const { view, page } = renderShell();
    const section = page("code-diff");

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
    expect(seen[0]).not.toContain("Default fixture");
  });
});
