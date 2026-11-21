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
      within(archetypes).getByRole("button", {
        name: new RegExp(GEN_UI_REGISTRY["decision-matrix"].label),
      })
    );

    expect(view.container.querySelectorAll("[data-archetype]").length).toBeGreaterThan(0);
    // The remounted gallery scrolls to the archetype that was picked.
    expect(scrolled.at(-1)).toBe("decision-matrix");
  });

  test("each archetype has Component / Model instructions tabs", () => {
    const view = renderShell();
    const section = view.container.querySelector('[data-archetype="measure"]');

    expect(section).toBeTruthy();
    const tabs = within(section as HTMLElement).getByRole("tablist", { name: "measure view" });
    const instructions = within(tabs).getByRole("tab", { name: "Model instructions" });

    expect(within(tabs).getByRole("tab", { name: "Component" })).toBeTruthy();
    expect(instructions).toBeTruthy();

    // Radix tabs need pointer down before click in jsdom (same as onboarding-guide tests).
    fireEvent.mouseDown(instructions);
    fireEvent.click(instructions);

    expect(
      within(tabs).getByRole("tab", { name: "Model instructions", selected: true })
    ).toBeTruthy();
    expect(
      within(section as HTMLElement).getByRole("heading", { name: "Measure", level: 2 })
    ).toBeTruthy();
    expect(within(section as HTMLElement).getByText(/Gen UI · Model instructions/i)).toBeTruthy();
    expect(
      within(section as HTMLElement).getByRole("button", { name: /Shared rules/i })
    ).toBeTruthy();
  });

  test("showcase archetypes expose a Component states toolbar", () => {
    const view = renderShell();
    const section = view.container.querySelector('[data-archetype="progress-track"]');

    expect(section).toBeTruthy();
    expect(
      within(section as HTMLElement).getByRole("group", { name: "Component states" })
    ).toBeTruthy();
    expect(within(section as HTMLElement).getByLabelText(/state 1 of/i)).toBeTruthy();

    fireEvent.click(within(section as HTMLElement).getByRole("button", { name: "Next state" }));
    expect(within(section as HTMLElement).getByText("Just started")).toBeTruthy();
  });

  test("Stage size changes the preview footprint independently of component state", () => {
    const view = renderShell();
    const section = view.container.querySelector<HTMLElement>('[data-archetype="measure"]')!;
    const demo = within(section);
    const size = demo.getByRole<HTMLSelectElement>("combobox", { name: "Stage size" });
    const preview = demo.getByRole("region", { name: "Stage preview" });

    expect(preview.style.width).toBe("100%");
    expect(preview.style.aspectRatio).toBe("24 / 18");
    expect(within(preview).getByText("Share of world population")).toBeTruthy();

    fireEvent.change(size, { target: { value: "0" } });
    expect(size.selectedOptions[0].textContent).toContain("Quarter");
    expect(parseFloat(preview.style.width)).toBeCloseTo((11 / 24) * 100);
    expect(preview.style.aspectRatio).toBe("11 / 8");
    expect(within(preview).getByText("Share of world population")).toBeTruthy();

    fireEvent.change(size, { target: { value: "1" } });
    fireEvent.click(demo.getByRole("button", { name: "Next state" }));
    expect(preview.style.aspectRatio).toBe("11 / 18");
    expect(within(preview).getByText("Ancient population share")).toBeTruthy();
  });

  test("horizontal touch swipes step variants and vertical gestures leave the state alone", () => {
    const view = renderShell();
    const section = view.container.querySelector<HTMLElement>('[data-archetype="measure"]')!;
    const demo = within(section);

    function swipe(startX: number, startY: number, endX: number, endY: number) {
      const preview = demo.getByRole("region", { name: "Stage preview" }).firstElementChild!;

      fireEvent.touchStart(preview, {
        touches: [{ identifier: 1, clientX: startX, clientY: startY }],
      });
      fireEvent.touchEnd(preview, {
        changedTouches: [{ identifier: 1, clientX: endX, clientY: endY }],
      });
    }

    swipe(180, 180, 95, 60);
    expect(demo.getByText("Share of world population")).toBeTruthy();
    swipe(180, 180, 95, 165);
    expect(demo.getByText("Ancient population share")).toBeTruthy();
    swipe(95, 165, 180, 180);
    expect(demo.getByText("Share of world population")).toBeTruthy();
  });
});
