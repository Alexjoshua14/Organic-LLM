import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

/**
 * Mermaid's real `render()` needs browser-only globals JSDOM lacks (see mermaid-diagram.test.tsx),
 * so the module is mocked: the Diagram page still mounts the real `MermaidToolDiagram`, and the
 * mock reports which source it was asked to draw.
 */
const renderedSources: string[] = [];
const mermaidMock = {
  initialize: (_cfg: unknown) => {},
  parse: async (_code: string) => true,
  render: async (_id: string, code: string) => {
    renderedSources.push(code);

    return { svg: '<svg xmlns="http://www.w3.org/2000/svg"><g class="node"><text>Node</text></g></svg>' };
  },
};

mock.module("mermaid", () => ({ default: mermaidMock }));

mock.module("@heroui/modal", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => children,
  ModalContent: ({ children }: { children: React.ReactNode }) => children,
  ModalHeader: ({ children }: { children: React.ReactNode }) => children,
  ModalBody: ({ children }: { children: React.ReactNode }) => children,
  ModalFooter: ({ children }: { children: React.ReactNode }) => children,
  useDisclosure: () => ({ isOpen: false, onOpen: () => {}, onOpenChange: () => {} }),
}));

const { GenUiLabShell } = await import(
  "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiLabShell"
);
const {
  GenUiMermaidDiagramDemo,
  GenUiMermaidDiagramDemoToolbar,
  LAB_DIAGRAM_ARCHETYPE,
  LAB_DIAGRAM_PRESETS,
  useGenUiMermaidDiagramDemo,
} = await import("@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiMermaidDiagramDemo");
const { GEN_UI_ARRANGEMENT_INTERVAL_MS } = await import(
  "@/app/sandbox/prototypes/gen-ui-lab/_hooks/use-gen-ui-arrangement-cycle"
);
const { MERMAID_DENSE_OVERVIEW, MERMAID_FLOWCHART_EDGE_LABELS } = await import(
  "@/app/sandbox/prototypes/_fixtures/mermaid-fixtures"
);
const { GEN_UI_REGISTRY } = await import("@/components/chat/gen-ui/registry");
const { buildDefaultBlockMap } = await import("@/lib/sandbox/gen-ui-lab");

let restoreMedia: () => void;
const originalObserver = globalThis.IntersectionObserver;
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  restoreMedia = installBrowserMedia();
  renderedSources.length = 0;
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

function renderShell() {
  const view = render(<GenUiLabShell initialBlocks={buildDefaultBlockMap()} />);
  const section = view.container.querySelector<HTMLElement>(
    `[data-archetype="${LAB_DIAGRAM_ARCHETYPE}"]`
  )!;

  return { view, section };
}

function DiagramHarness({ active = true }: { active?: boolean }) {
  const demo = useGenUiMermaidDiagramDemo(active);

  return (
    <section>
      <GenUiMermaidDiagramDemoToolbar demo={demo} />
      <div data-testid="preview-canvas">
        <GenUiMermaidDiagramDemo demo={demo} />
      </div>
    </section>
  );
}

describe("Gen UI Lab Diagram page", () => {
  test("Diagram is a gallery page, a sidebar entry and a dot after the block types", () => {
    const { view, section } = renderShell();
    const archetypes = view.getByRole("navigation", { name: "Gen UI archetypes" });
    const pages = view.container.querySelectorAll("[data-archetype]");

    // Lab-only pages follow the block types: Diagram, then Code.
    expect(pages.length).toBe(Object.keys(GEN_UI_REGISTRY).length + 2);
    expect(pages[pages.length - 2]).toBe(section);
    expect(within(archetypes).getByRole("button", { name: /Diagram/ })).toBeTruthy();
    expect(view.getByRole("button", { name: "Diagram" })).toBeTruthy();
  });

  test("the page renders the real tool diagram, unwrapped, under its preset toolbar", async () => {
    const { section } = renderShell();
    const toolbar = within(section).getByRole("group", { name: "Diagram presets" });

    expect(within(toolbar).getByText("Glance")).toBeTruthy();
    expect(within(section).getByLabelText("Preset 1 of 4")).toBeTruthy();
    // No lab card heading: the only chrome is the component's own well.
    expect(within(section).queryByRole("heading")).toBeNull();

    await waitFor(() => {
      expect(section.querySelector(".mermaid svg")).not.toBeNull();
    });
    expect(section.querySelector(".mermaid svg")?.getAttribute("aria-label")).toBe("Order request check");
    expect(renderedSources.at(-1)).toContain(MERMAID_FLOWCHART_EDGE_LABELS.split("\n")[1]!.trim());
  });

  test("prev/next cycle the presets, wrap, and redraw the diagram", async () => {
    const { section } = renderShell();
    const next = within(section).getByRole("button", { name: "Next preset" });

    fireEvent.click(next);
    expect(within(section).getByLabelText("Preset 2 of 4")).toBeTruthy();
    expect(within(section).getByText("Overview")).toBeTruthy();
    await waitFor(() => {
      expect(section.querySelector(".mermaid svg")?.getAttribute("aria-label")).toBe("Chat request path");
    });
    // Inline always draws the overview source, as in chat.
    expect(renderedSources.at(-1)).toContain('A["Client"] --> B["API Gateway"]');
    expect(renderedSources.at(-1)).toContain(MERMAID_DENSE_OVERVIEW.split("\n").at(-1)!.trim());
    expect(renderedSources.at(-1)).not.toContain("Validate + repair");

    fireEvent.click(within(section).getByRole("button", { name: "Previous preset" }));
    fireEvent.click(within(section).getByRole("button", { name: "Previous preset" }));
    expect(LAB_DIAGRAM_PRESETS).toHaveLength(4);
    expect(within(section).getByLabelText("Preset 4 of 4")).toBeTruthy();
    expect(within(section).getByText("Long labels")).toBeTruthy();
    // The arrows keep their identity while the diagram changes under them.
    expect(within(section).getByRole("button", { name: "Next preset" })).toBe(next);
  });

  test("Generate with AI stays in place but is a no-op on the Diagram page", () => {
    const { view } = renderShell();
    const archetypes = view.getByRole("navigation", { name: "Gen UI archetypes" });
    const generate = view.getByRole("button", { name: "Generate with AI" }) as HTMLButtonElement;
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    expect(generate.disabled).toBe(false);
    fireEvent.click(within(archetypes).getByRole("button", { name: /Diagram/ }));
    expect(generate.disabled).toBe(true);
    fireEvent.click(generate);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    fireEvent.click(view.getByRole("button", { name: "Reset fixtures" }));
    expect(view.getByText("Reset to fixture data.")).toBeTruthy();
    expect(view.container.querySelector(`[data-archetype="${LAB_DIAGRAM_ARCHETYPE}"]`)).not.toBeNull();
  });
});

describe("Gen UI Lab Diagram presets: Auto", () => {
  let hiddenDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
    else Reflect.deleteProperty(document, "hidden");
  });

  const advance = () => act(() => jest.advanceTimersByTime(GEN_UI_ARRANGEMENT_INTERVAL_MS));

  test("Auto is off by default, cycles once on, pauses on hover and off-page", () => {
    const view = render(<DiagramHarness />);
    const auto = view.getByRole("button", { name: "Auto" });

    expect(auto.getAttribute("aria-pressed")).toBe("false");
    advance();
    expect(view.getByLabelText("Preset 1 of 4")).toBeTruthy();

    fireEvent.click(auto);
    advance();
    expect(view.getByLabelText("Preset 2 of 4")).toBeTruthy();

    const host = view.getByTestId("preview-canvas").firstElementChild!;

    fireEvent.pointerEnter(host);
    advance();
    expect(view.getByLabelText("Preset 2 of 4")).toBeTruthy();
    fireEvent.pointerLeave(host);

    view.rerender(<DiagramHarness active={false} />);
    advance();
    expect(view.getByLabelText("Preset 2 of 4")).toBeTruthy();
    view.rerender(<DiagramHarness active />);
    advance();
    expect(view.getByLabelText("Preset 3 of 4")).toBeTruthy();
  });
});
