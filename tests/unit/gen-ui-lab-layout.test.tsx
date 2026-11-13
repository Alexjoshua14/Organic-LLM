import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import {
  GenUiDecisionDemoToolbar,
  useGenUiDecisionDemo,
} from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiDecisionDemo";
import { GenUiGalleryNav } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiGalleryNav";
import { GenUiGallerySection } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiGallerySection";
import { GenUiLabShell } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiLabShell";
import { buildDefaultBlockMap } from "@/lib/sandbox/gen-ui-lab";

let restoreMedia: () => void;

beforeEach(() => {
  restoreMedia = installBrowserMedia();
});

afterEach(() => {
  cleanup();
  restoreMedia();
});

function Toolbar() {
  return <GenUiDecisionDemoToolbar demo={useGenUiDecisionDemo(true)} />;
}

describe("Gen UI Lab layout", () => {
  test("gallery dots take keyboard focus without a ring and open their label", () => {
    const view = render(
      <GenUiGalleryNav activeIndex={0} count={2} labels={["One", "Two"]} onSelectIndex={() => {}} />
    );
    const dot = view.getByRole("button", { name: "Two" });

    expect(dot.className).not.toMatch(/outline-2|ring/);
    expect(dot.className).toContain("focus-visible:outline-none");
    fireEvent.focus(dot);
    expect(dot.querySelector(".gen-ui-gallery-nav__label")).not.toBeNull();
  });

  test("the arrangement toolbar reserves its intent lines so the arrows cannot move", () => {
    const view = render(<Toolbar />);
    const next = view.getByRole("button", { name: "Next arrangement" });
    const intent = view.container.querySelector("p.line-clamp-2");

    expect(intent?.className).toContain("min-h-10");
    expect(next.className).toContain("focus-visible:bg-foreground");
    expect(next.className).not.toMatch(/ring/);
  });

  test("a gallery section's header scrolls with its page, above the centred content", () => {
    const view = render(
      <GenUiGallerySection
        active
        archetype="decision-matrix"
        header={<p>section controls</p>}
        registerRef={() => {}}
      >
        <p>component</p>
      </GenUiGallerySection>
    );
    const page = view.container.querySelector("article");
    const header = view.getByText("section controls");
    const body = view.getByText("component");

    // The header is a sibling that precedes the centred body inside the same page, so a taller
    // component cannot re-centre it and it cannot outlive the page it belongs to.
    expect(page?.contains(header)).toBe(true);
    expect(page?.contains(body)).toBe(true);
    expect(header.parentElement?.nextElementSibling?.contains(body)).toBe(true);
    expect(header.parentElement?.className).toContain("shrink-0");
  });

  test("a gallery section without a header renders only the centred body", () => {
    const view = render(
      <GenUiGallerySection active archetype="plan-timeline" registerRef={() => {}}>
        <p>component</p>
      </GenUiGallerySection>
    );

    expect(view.container.querySelector("article")?.children).toHaveLength(1);
  });
});

/**
 * jsdom does not evaluate Tailwind, so these guard the class contract the layout depends on: on a
 * phone the lab is the focused component and the dot rail, and nothing else.
 */
describe("Gen UI Lab on a phone", () => {
  function renderShell() {
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
    Element.prototype.scrollIntoView = () => {};

    return render(<GenUiLabShell initialBlocks={buildDefaultBlockMap()} />);
  }

  test("the control column exists only from 56rem up; narrow, only the stage remains", () => {
    const view = renderShell();
    const aside = view.container.querySelector("aside")!;

    expect(aside.className).toContain("hidden");
    expect(aside.className).toContain("@min-[56rem]:flex");
    // One row, the stage: no stacked controls row above it.
    expect(view.container.querySelector("[data-gen-ui-lab-root] > div")?.className).toContain(
      "grid-rows-[minmax(0,1fr)]"
    );
    expect(view.queryByRole("combobox", { name: "Preview component" })).toBeNull();
  });

  test("the stage keeps clear of the dot rail", () => {
    const view = renderShell();
    const stage = view.container.querySelector("aside + section")!;

    expect(stage.className).toContain("pr-8");
    expect(stage.className).toContain("@min-[56rem]:px-12");
  });

  test("the dot rail is on at every width, with a touch-sized target per dot", () => {
    const view = renderShell();
    const rail = view.getByRole("navigation", { name: "Gallery sections" });

    expect(rail.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(rail.className).toContain("flex");
    const dots = within(rail).getAllByRole("button");

    expect(dots.length).toBeGreaterThan(5);
    for (const dot of dots) {
      expect(dot.className).toContain("size-7");
      expect(dot.className).toContain("@min-[56rem]:w-[var(--row-w)]");
    }
    // Tapping a dot jumps to that page.
    expect(() => fireEvent.click(dots[2]!)).not.toThrow();
  });

  test("narrow, a dot stays a bare dot: no label and no slide, even when focused", () => {
    const view = render(
      <div data-gen-ui-lab-root>
        <GenUiGalleryNav
          activeIndex={0}
          count={2}
          labels={["One", "Two"]}
          onSelectIndex={() => {}}
        />
      </div>
    );
    const dot = view.getByRole("button", { name: "Two" });

    // jsdom lays nothing out: the lab root measures 0px wide, which is narrow.
    fireEvent.focus(dot);
    expect(dot.querySelector(".gen-ui-gallery-nav__label")).toBeNull();
  });

  test("wide, the same dot opens its label", () => {
    const view = render(
      <div
        data-gen-ui-lab-root
        // Attached at commit, before the nav's effect measures the root.
        ref={(element) => {
          if (element) element.getBoundingClientRect = () => ({ width: 1100 }) as DOMRect;
        }}
      >
        <GenUiGalleryNav
          activeIndex={0}
          count={2}
          labels={["One", "Two"]}
          onSelectIndex={() => {}}
        />
      </div>
    );
    const dot = view.getByRole("button", { name: "Two" });

    fireEvent.focus(dot);
    expect(dot.querySelector(".gen-ui-gallery-nav__label")).not.toBeNull();
  });

  test("the lab's own controls grow to 44px on touch devices", () => {
    const view = render(<Toolbar />);

    expect(view.getByRole("button", { name: "Next arrangement" }).className).toContain(
      "pointer-coarse:size-11"
    );
    expect(view.getByRole("button", { name: "Previous arrangement" }).className).toContain(
      "pointer-coarse:size-11"
    );
  });

  test("snapping stays mandatory on touch, so one quick swipe moves one section", async () => {
    const css = await Bun.file("styles/globals.css").text();
    const rule = css.match(/\.gen-ui-gallery-scroll\s*\{[^}]*\}/)?.[0] ?? "";

    expect(rule).toContain("scroll-snap-type: y mandatory");
    // No touch override: proximity let a flick settle between pages instead of advancing.
    expect(css).not.toMatch(/@media \(pointer: coarse\)\s*\{\s*\.gen-ui-gallery-scroll/);
  });
});
