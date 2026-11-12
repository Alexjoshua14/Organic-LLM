import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import { GenUiLabShell } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiLabShell";
import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { buildDefaultBlockMap } from "@/lib/sandbox/gen-ui-lab";

let restoreMedia: () => void;
let scrolled: string[];
const originalObserver = globalThis.IntersectionObserver;
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  restoreMedia = installBrowserMedia();
  scrolled = [];
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.getAttribute("data-archetype") ?? "");
  };
});

afterEach(() => {
  cleanup();
  restoreMedia();
  globalThis.IntersectionObserver = originalObserver;
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function renderShell() {
  return render(<GenUiLabShell initialBlocks={buildDefaultBlockMap()} />);
}

describe("Gen UI Lab shell", () => {
  test("the gallery is the only mode: no Focus switch, one snap page per archetype", () => {
    const view = renderShell();

    expect(view.queryByRole("button", { name: "Focus" })).toBeNull();
    expect(view.queryByRole("group", { name: "Preview mode" })).toBeNull();
    // Every Gen UI block type, plus the lab-only Diagram page.
    expect(view.container.querySelectorAll("[data-archetype]").length).toBe(
      Object.keys(GEN_UI_REGISTRY).length + 1
    );
  });

  test("a rendering state replaces the gallery, and picking an archetype returns to it", () => {
    const view = renderShell();
    const archetypes = view.getByRole("navigation", { name: "Gen UI archetypes" });

    fireEvent.click(view.getByRole("button", { name: "Partial recovery" }));
    expect(view.container.querySelector("[data-archetype]")).toBeNull();

    scrolled.length = 0;
    fireEvent.click(
      within(archetypes).getByRole("button", { name: new RegExp(GEN_UI_REGISTRY["decision-matrix"].label) })
    );

    expect(view.container.querySelectorAll("[data-archetype]").length).toBeGreaterThan(0);
    // The remounted gallery scrolls to the archetype that was picked.
    expect(scrolled.at(-1)).toBe("decision-matrix");
  });
});
