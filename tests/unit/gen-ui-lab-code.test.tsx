import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import {
  LAB_CODE_ARCHETYPE,
  LAB_CODE_PRESETS,
} from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiCodeBlockDemo";
import { GenUiLabShell } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiLabShell";
import { buildDefaultBlockMap } from "@/lib/sandbox/gen-ui-lab";

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

/** The code blocks on the page, not the toolbar: the picker also prints the language name. */
function blocks(section: HTMLElement) {
  return Array.from(section.querySelectorAll<HTMLElement>("[data-wrap]"));
}

function renderShell() {
  const view = render(<GenUiLabShell initialBlocks={buildDefaultBlockMap()} />);
  const section = view.container.querySelector<HTMLElement>(
    `[data-archetype="${LAB_CODE_ARCHETYPE}"]`
  )!;

  return { view, section };
}

describe("Gen UI Lab Code page", () => {
  test("Code is the last gallery page and a sidebar entry", () => {
    const { view, section } = renderShell();
    const archetypes = view.getByRole("navigation", { name: "Gen UI archetypes" });
    const pages = view.container.querySelectorAll("[data-archetype]");

    expect(pages[pages.length - 1]).toBe(section);
    expect(within(archetypes).getByRole("button", { name: /code block$/i })).toBeTruthy();
  });

  test("the page renders real markdown through the shared code block under a preset toolbar", () => {
    const { section } = renderShell();
    const toolbar = within(section).getByRole("group", { name: "Code presets" });

    expect(within(toolbar).getByText("Snippet")).toBeTruthy();
    expect(within(section).getByLabelText(`Preset 1 of ${LAB_CODE_PRESETS.length}`)).toBeTruthy();
    expect(within(blocks(section)[0]!).getByText("TypeScript")).toBeTruthy();
    expect(section.querySelector(".token.keyword")).not.toBeNull();
    expect(within(section).getByRole("button", { name: "Copy code" })).toBeTruthy();
  });

  test("prev/next step through the presets: gutter, shell, plain and long block", () => {
    const { section } = renderShell();
    const next = within(section).getByRole("button", { name: "Next preset" });

    // Snippet: the TypeScript sample, seven lines. Reference: 25 lines, numbered.
    expect(within(blocks(section)[0]!).getByText("TypeScript")).toBeTruthy();
    expect(within(blocks(section)[0]!).getByText("· 7 lines")).toBeTruthy();
    fireEvent.click(next);
    expect(within(section).getByText("Reference")).toBeTruthy();
    expect(within(section).getByText("25")).toBeTruthy();

    fireEvent.click(next);
    expect(within(section).getByText("Command")).toBeTruthy();
    expect(blocks(section).map((block) => within(block).queryByText("Shell") !== null)).toEqual([
      true,
      true,
    ]);

    fireEvent.click(next);
    fireEvent.click(next);
    expect(within(section).getByText("Languages")).toBeTruthy();
    for (const label of ["Python", "JSON", "SQL", "CSS", "YAML"]) {
      expect(blocks(section).some((block) => within(block).queryByText(label) !== null)).toBe(true);
    }

    fireEvent.click(next);
    expect(within(section).getByText("Plain")).toBeTruthy();
    expect(section.querySelector(".token")).toBeNull();
    expect(blocks(section).some((block) => within(block).queryByText("Cobol") !== null)).toBe(true);

    fireEvent.click(next);
    expect(within(section).getByText("Long block")).toBeTruthy();
    expect(within(section).getByText("· 90 lines")).toBeTruthy();
    // Complete on mount, so it is colored at once despite exceeding the streaming threshold.
    expect(section.querySelector(".token.keyword")).not.toBeNull();
    expect(within(section).getByRole("button", { name: "Next preset" })).toBe(next);
  });

  test("the last preset is the mermaid fence, which keeps a diagram and no code chrome", () => {
    const last = LAB_CODE_PRESETS[LAB_CODE_PRESETS.length - 1]!;

    expect(last.id).toBe("diagram");
    expect(last.markdown).toContain("```mermaid");
  });

  test("Generate with AI is disabled on the Code page and does not call the lab API", () => {
    const { view } = renderShell();
    const archetypes = view.getByRole("navigation", { name: "Gen UI archetypes" });
    const generate = view.getByRole("button", { name: "Generate with AI" }) as HTMLButtonElement;
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    fireEvent.click(within(archetypes).getByRole("button", { name: /code block$/i }));
    expect(generate.disabled).toBe(true);
    fireEvent.click(generate);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
