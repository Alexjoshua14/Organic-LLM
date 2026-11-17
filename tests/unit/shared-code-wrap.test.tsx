import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { render } from "../helpers/render";

import { CodeBlock } from "@/components/shared/code-block";
import { CodeSurface } from "@/components/shared/code/code-surface";
import { applyMermaidGlassStyles, MERMAID_MIN_FIT_SCALE } from "@/lib/mermaid/presentation";

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");

/** A phone: matchMedia reports the narrow query as matching. */
function setNarrow(narrow: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: narrow,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

afterEach(() => {
  cleanup();
  if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
  else Reflect.deleteProperty(window, "matchMedia");
});

function block(wrap?: boolean) {
  return (
    <CodeBlock wrap={wrap}>
      <code className="language-ts">{"const answer = 42;\nconsole.log(answer);"}</code>
    </CodeBlock>
  );
}

function surfaceOf(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-wrap]") as HTMLElement;
}

describe("narrow-screen wrapping", () => {
  test("a wide screen scrolls, but leaves the narrow-screen rule to CSS (data-wrap=auto)", () => {
    setNarrow(false);
    const view = render(block());

    expect(surfaceOf(view.container).dataset.wrap).toBe("auto");
    expect(view.getByRole("button", { name: "Wrap lines" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  test("a phone reads as wrapped until the reader chooses", () => {
    setNarrow(true);
    const view = render(block());
    const toggle = view.getByRole("button", { name: "Wrap lines" });

    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    // The scroll region is not a tab stop while there is nothing to scroll.
    expect(view.getByRole("region", { name: "TypeScript code" }).hasAttribute("tabindex")).toBe(
      false
    );

    fireEvent.click(toggle);
    expect(surfaceOf(view.container).dataset.wrap).toBe("false");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);
    expect(surfaceOf(view.container).dataset.wrap).toBe("true");
  });

  test("on a wide screen the toggle turns wrapping on, and an author default wraps from the start", () => {
    setNarrow(false);
    const view = render(block());

    fireEvent.click(view.getByRole("button", { name: "Wrap lines" }));
    expect(surfaceOf(view.container).dataset.wrap).toBe("true");

    cleanup();
    const authored = render(block(true));

    expect(surfaceOf(authored.container).dataset.wrap).toBe("true");
  });

  test("CodeSurface names the three states", () => {
    const view = render(
      <>
        <CodeSurface wrap>x</CodeSurface>
        <CodeSurface autoWrap>y</CodeSurface>
        <CodeSurface>z</CodeSurface>
      </>
    );
    const states = [...view.container.querySelectorAll<HTMLElement>("[data-wrap]")].map(
      (node) => node.dataset.wrap
    );

    expect(states).toEqual(["true", "auto", "false"]);
  });
});

describe("diagram fit", () => {
  function svgWithViewBox(width: number) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    // JSDOM has no layout, so give the viewBox the one property the helper reads.
    Object.defineProperty(svg, "viewBox", { value: { baseVal: { width, height: 100 } } });

    return svg as SVGSVGElement;
  }

  test("an inline diagram may shrink to its well, but not past the legible floor", () => {
    const svg = svgWithViewBox(400);

    applyMermaidGlassStyles(svg, { fit: true });
    expect(svg.style.width).toBe("400px");
    expect(svg.style.maxWidth).toBe("100%");
    expect(svg.style.minWidth).toBe(`${Math.round(400 * MERMAID_MIN_FIT_SCALE)}px`);
    // Centered with auto margins, so an overflowing diagram starts at the left edge.
    expect(svg.style.marginInline).toBe("auto");
  });

  test("a panned diagram keeps its natural size", () => {
    const svg = svgWithViewBox(400);

    applyMermaidGlassStyles(svg);
    expect(svg.style.maxWidth).toBe("none");
    expect(svg.style.minWidth).toBe("");
  });
});
