import { describe, expect, test } from "bun:test";

import { augmentUserMessageWithDiagramLinks } from "@/lib/mermaid/augment-message";
import {
  buildNodeNeighborhood,
  extractMermaidNodeIds,
  formatDiagramNodeContext,
  validateSharedNodeIds,
} from "@/lib/mermaid/node-graph";

describe("extractMermaidNodeIds", () => {
  test("collects flowchart node and edge ids", () => {
    const source = ['flowchart TD', '  A["Start"] --> B["End"]'].join("\n");
    const ids = extractMermaidNodeIds(source);

    expect(ids).toContain("A");
    expect(ids).toContain("B");
  });
});

describe("validateSharedNodeIds", () => {
  test("returns null when overview ids are subset of detailed", () => {
    const overview = "flowchart TD\n  A --> B";
    const detailed = "flowchart TD\n  A --> B\n  B --> C";

    expect(validateSharedNodeIds(overview, detailed)).toBeNull();
  });

  test("reports overview ids missing from detailed", () => {
    const overview = "flowchart TD\n  A --> X";
    const detailed = "flowchart TD\n  A --> B";

    expect(validateSharedNodeIds(overview, detailed)).toMatch(/X/);
  });
});

describe("buildNodeNeighborhood", () => {
  test("returns neighbors and edges for a focus node", () => {
    const source = [
      "flowchart TD",
      '  A["Alpha"] -->|yes| B["Beta"]',
      '  B --> C["Gamma"]',
    ].join("\n");

    const hood = buildNodeNeighborhood(source, "B");

    expect(hood.neighbors.map((n) => n.id).sort()).toEqual(["A", "C"]);
    expect(hood.edges.length).toBeGreaterThanOrEqual(2);
  });
});

describe("formatDiagramNodeContext", () => {
  test("includes focus label and neighbors, not full source", () => {
    const text = formatDiagramNodeContext({
      label: "Beta",
      title: "Flow",
      density: "overview",
      neighborhood: {
        neighbors: [{ id: "A", label: "Alpha" }],
        edges: [{ from: "A", to: "B", label: "yes" }],
      },
    });

    expect(text).toContain("Focus node: Beta");
    expect(text).toContain("Alpha");
    expect(text).not.toContain("flowchart");
  });
});

describe("augmentUserMessageWithDiagramLinks", () => {
  test("prepends context to the first text part", () => {
    const message = {
      id: "m1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Why does this branch matter?" }],
    };

    const augmented = augmentUserMessageWithDiagramLinks(message, [
      {
        id: "l1",
        diagramId: "d1",
        nodeId: "B",
        label: "Beta",
        neighborhood: { neighbors: [], edges: [] },
      },
    ]);

    const text = augmented.parts.find((p) => p.type === "text");

    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toContain("[Diagram node context]");
      expect(text.text).toContain("Why does this branch matter?");
    }
  });
});
