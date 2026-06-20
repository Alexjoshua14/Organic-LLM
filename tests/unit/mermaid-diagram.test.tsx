import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

/**
 * Mermaid's real `render()` needs browser-only globals (CSSStyleSheet) that
 * JSDOM lacks, so we mock the module and assert the component's contract:
 * it parses, renders, sanitizes the SVG into the DOM, and falls back to an
 * error state when Mermaid throws. End-to-end visual rendering is covered by
 * the Playwright e2e (tests/e2e/mermaid.spec.ts).
 */
const mermaidMock = {
  initialize: (_cfg: unknown) => {},
  parse: async (_code: string) => true,
  render: async (_id: string, _code: string) => ({
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><g class="node"><text>Hello</text></g></svg>',
  }),
};

mock.module("mermaid", () => ({ default: mermaidMock }));

// Keep the test focused on render/sanitize/error logic, not HeroUI internals.
mock.module("@heroui/modal", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => children,
  ModalContent: ({ children }: { children: React.ReactNode }) => children,
  ModalHeader: ({ children }: { children: React.ReactNode }) => children,
  ModalBody: ({ children }: { children: React.ReactNode }) => children,
  useDisclosure: () => ({ isOpen: false, onOpen: () => {}, onOpenChange: () => {} }),
}));

const { MermaidDiagram } = await import("@/components/blog/mermaid-diagram");

beforeEach(() => {
  mermaidMock.initialize = () => {};
  mermaidMock.parse = async () => true;
  mermaidMock.render = async () => ({
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><g class="node"><text>Hello</text></g></svg>',
  });
});

afterEach(() => cleanup());

describe("MermaidDiagram", () => {
  test("renders the diagram SVG with an accessible role/label", async () => {
    const { container } = render(<MermaidDiagram code="flowchart TD\n  A --> B" />);

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Diagram");
    expect(container.textContent).toContain("Hello");
  });

  test("sanitizes script tags out of Mermaid's SVG output before injecting", async () => {
    mermaidMock.render = async () => ({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><g class="node"><text>Safe</text></g></svg>',
    });

    const { container } = render(<MermaidDiagram code="flowchart TD\n  A --> B" />);

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("Safe");
  });

  test("keeps a rendered diagram when post-render layering would throw (nodes not under root)", async () => {
    // `.nodes` nested under a wrapper (not a direct child of root) would make
    // root.insertBefore(edgePaths, nodes) throw NotFoundError — must not blank the diagram.
    mermaidMock.render = async () => ({
      svg:
        '<svg xmlns="http://www.w3.org/2000/svg"><g>' +
        '<g class="wrap"><g class="nodes"><text>Kept</text></g></g>' +
        '<g class="edgePaths"></g><g class="edgeLabels"></g>' +
        "</g></svg>",
    });

    const { container } = render(<MermaidDiagram code="stateDiagram-v2\n  [*] --> Idle" />);

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });

    expect(container.textContent).toContain("Kept");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  test("falls back to an error message when Mermaid cannot render", async () => {
    mermaidMock.parse = async () => {
      throw new Error("Parse error on line 1");
    };
    mermaidMock.render = async () => {
      throw new Error("Parse error on line 1");
    };

    const { container, findByRole } = render(<MermaidDiagram code="flowchart TD\n  A -->" />);

    const alert = await findByRole("alert");
    expect(alert.textContent).toContain("Diagram could not be rendered");
    expect(container.querySelector("svg")).toBeNull();
  });
});
