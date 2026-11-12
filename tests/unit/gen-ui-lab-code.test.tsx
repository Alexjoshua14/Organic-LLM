import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import { GenUiLabShell } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiLabShell";
import { LAB_CODE_PRESETS } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiCodeDemo";
import { buildDefaultBlockMap } from "@/lib/sandbox/gen-ui-lab";

const PAGE = "code-diff";

let restoreMedia: () => void;
const originalObserver = globalThis.IntersectionObserver;
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
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
  cleanup();
  restoreMedia();
  globalThis.IntersectionObserver = originalObserver;
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

/** The fenced code blocks on the page, not the toolbar: the picker also prints the language name. */
function blocks(section: HTMLElement) {
  return Array.from(section.querySelectorAll<HTMLElement>("[data-wrap]"));
}

function renderShell() {
  const view = render(<GenUiLabShell initialBlocks={buildDefaultBlockMap()} />);
  const section = view.container.querySelector<HTMLElement>(`[data-archetype="${PAGE}"]`)!;

  return { view, section };
}

function step(section: HTMLElement, times: number) {
  for (let i = 0; i < times; i += 1) {
    fireEvent.click(within(section).getByRole("button", { name: "Next preset" }));
  }
}

describe("Gen UI Lab Code page", () => {
  test("one Code page covers code and code diff: no separate code page, Diagram stays last", () => {
    const { view, section } = renderShell();
    const archetypes = view.getByRole("navigation", { name: "Gen UI archetypes" });
    const pages = view.container.querySelectorAll("[data-archetype]");

    expect(view.container.querySelector('[data-archetype="code-block"]')).toBeNull();
    // The registry calls it "Code diff"; the lab calls the page Code.
    expect(within(archetypes).getByRole("button", { name: /^Code.*code diff$/ })).toBeTruthy();
    expect(pages[pages.length - 1]).not.toBe(section);
    expect(pages[pages.length - 1]!.getAttribute("data-archetype")).toBe("mermaid-diagram");
  });

  test("the slides: Snippet, Diff and Fixture first, then the layout checks; no Languages or Diagram slide", () => {
    expect(LAB_CODE_PRESETS.map((preset) => preset.id)).toEqual([
      "snippet",
      "diff",
      "fixture",
      "reference",
      "command",
      "long-lines",
      "plain",
      "long-block",
    ]);
  });

  test("Snippet is one real fenced block with the language dropdown beside it", () => {
    const { section } = renderShell();
    const toolbar = within(section).getByRole("group", { name: "Code presets" });

    expect(within(toolbar).getByText("Snippet")).toBeTruthy();
    expect(within(section).getByLabelText(`Preset 1 of ${LAB_CODE_PRESETS.length}`)).toBeTruthy();
    expect(blocks(section)).toHaveLength(1);
    expect(within(blocks(section)[0]!).getByText("TypeScript")).toBeTruthy();
    expect(within(blocks(section)[0]!).getByText("· 7 lines")).toBeTruthy();
    expect(section.querySelector(".token.keyword")).not.toBeNull();
    expect(within(section).getByRole("group", { name: "Language" })).toBeTruthy();
  });

  test("Diff is the same language as a unified diff, through the code diff block", () => {
    const { section } = renderShell();

    step(section, 1);
    expect(within(section).getByText("Diff")).toBeTruthy();
    expect(blocks(section)).toHaveLength(1);
    expect(within(section).getByRole("region", { name: "Diff of lib/subscribe.ts" })).toBeTruthy();
    expect(section.textContent).toContain("A small TypeScript change");
    expect(section.querySelector(".token.keyword")).not.toBeNull();
    // The picker stays on this slide: it drives the diff too.
    expect(within(section).getByRole("group", { name: "Language" })).toBeTruthy();
  });

  test("Fixture is the page's schema fixture, and the language controls step aside", () => {
    const { section } = renderShell();

    step(section, 2);
    expect(within(section).getByText("Fixture")).toBeTruthy();
    expect(
      within(section).getByRole("heading", { level: 3, name: "Retry web search on rate limits" })
    ).toBeTruthy();
    expect(within(section).queryByRole("group", { name: "Language" })).toBeNull();
  });

  test("the layout slides: gutter, shell, wide lines, plain and a very long block", () => {
    const { section } = renderShell();

    step(section, 3);
    expect(within(section).getByText("Reference")).toBeTruthy();
    expect(within(section).getByText("25")).toBeTruthy();

    step(section, 1);
    expect(within(section).getByText("Command")).toBeTruthy();
    expect(blocks(section).map((block) => within(block).queryByText("Shell") !== null)).toEqual([
      true,
      true,
    ]);

    step(section, 1);
    expect(within(section).getByText("Long lines")).toBeTruthy();

    step(section, 1);
    expect(within(section).getByText("Plain")).toBeTruthy();
    expect(section.querySelector(".token")).toBeNull();
    expect(blocks(section).some((block) => within(block).queryByText("Cobol") !== null)).toBe(true);

    step(section, 1);
    expect(within(section).getByText("Long block")).toBeTruthy();
    expect(within(section).getByText("· 90 lines")).toBeTruthy();
    expect(section.querySelector(".token.keyword")).not.toBeNull();
  });

  test("Generate with AI works on this page and brings the Fixture slide up with its result", async () => {
    const generated = {
      type: "code-diff",
      version: 1,
      title: "Generated change for the lab",
      files: [{ path: "src/new.ts", diff: "@@\n-const a = 1;\n+const a = 2;" }],
    };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Generated.",
          generated: { blockType: "code-diff", block: generated },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const { view, section } = renderShell();
    const nav = view.getByRole("navigation", { name: "Gen UI archetypes" });

    fireEvent.click(within(nav).getByRole("button", { name: /^Code.*code diff$/ }));
    const generate = view.getByRole("button", { name: "Generate with AI" }) as HTMLButtonElement;

    expect(generate.disabled).toBe(false);
    expect(within(section).getByText("Snippet")).toBeTruthy();
    fireEvent.click(generate);

    await waitFor(() => expect(within(section).getByText("Fixture")).toBeTruthy());
    await waitFor(() =>
      expect(
        within(section).getByRole("heading", { level: 3, name: "Generated change for the lab" })
      ).toBeTruthy()
    );
    fetchSpy.mockRestore();
  });
});
