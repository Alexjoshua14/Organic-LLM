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

  test("each condensed preview keeps its core data and Full uses its own layout", () => {
    const view = renderShell();
    const page = (type: string) =>
      within(view.container.querySelector<HTMLElement>(`[data-archetype="${type}"]`)!);
    const measure = page("measure");
    const measurePreview = measure.getByRole("region", { name: "Component preview" });
    const measureSize = measure.getByRole<HTMLSelectElement>("combobox", { name: "Preview size" });

    expect(measureSize.value).toBe("full");
    expect(measurePreview.style.aspectRatio).toBe("");
    expect(measurePreview.className).not.toContain("overflow");
    fireEvent.change(measureSize, { target: { value: "condensed" } });
    expect(within(measurePreview).getByText("20–25%")).toBeTruthy();
    expect(within(measurePreview).getByText("22.5% point estimate")).toBeTruthy();
    expect(within(measurePreview).getByText("Ancient figures are estimates.")).toBeTruthy();

    const restaurant = page("restaurant-card");

    fireEvent.change(restaurant.getByRole("combobox", { name: "Preview size" }), {
      target: { value: "condensed" },
    });
    expect(restaurant.getByRole("heading", { name: "State Bird Provisions" })).toBeTruthy();
    expect(restaurant.getByText("4.5 / 5")).toBeTruthy();
    expect(restaurant.getByText(/1529 Fillmore St/)).toBeTruthy();
    expect(restaurant.queryByText(/3.8k reviews/)).toBeNull();

    const decision = page("decision-matrix");
    const decisionSize = decision.getByRole<HTMLSelectElement>("combobox", {
      name: "Preview size",
    });

    fireEvent.change(decisionSize, { target: { value: "condensed" } });
    const criterion = decision.getByRole<HTMLSelectElement>("combobox", {
      name: "Compare by criterion",
    });

    expect(decision.getByText("Condensed briefing")).toBeTruthy();
    expect(decision.getByRole("heading", { name: /Which database/ })).toBeTruthy();
    expect(decision.getByText("SQLite")).toBeTruthy();
    fireEvent.change(criterion, { target: { value: criterion.options[1].value } });
    expect(criterion.selectedIndex).toBe(1);
    fireEvent.click(decision.getByRole("button", { name: "Next arrangement" }));
    expect(decisionSize.value).toBe("full");
    expect(decision.queryByRole("combobox", { name: "Compare by criterion" })).toBeNull();
  });

  test("every Lab archetype has a readable Condensed view and can return to Full", () => {
    const view = renderShell();
    const pages = view.container.querySelectorAll<HTMLElement>("[data-archetype]");

    for (const section of pages) {
      const page = within(section);
      const size = page.getByRole<HTMLSelectElement>("combobox", { name: "Preview size" });
      const preview = page.getByRole("region", { name: "Component preview" });

      expect([...size.options].map((option) => option.textContent)).toEqual(["Full", "Condensed"]);
      fireEvent.change(size, { target: { value: "condensed" } });
      expect(size.value).toBe("condensed");
      expect(preview.firstElementChild).not.toBeNull();
      expect(preview.style.height).toBe("");
      expect(preview.style.aspectRatio).toBe("");
      fireEvent.change(size, { target: { value: "full" } });
      expect(size.value).toBe("full");
    }
  });

  test("horizontal touch swipes step variants and vertical gestures leave the state alone", () => {
    const view = renderShell();
    const section = view.container.querySelector<HTMLElement>('[data-archetype="measure"]')!;
    const demo = within(section);

    function swipe(startX: number, startY: number, endX: number, endY: number) {
      const preview = demo.getByRole("region", { name: "Component preview" }).firstElementChild!;

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
