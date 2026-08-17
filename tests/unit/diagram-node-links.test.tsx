import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";

import { render } from "../helpers/render";

import { DiagramNodeLinksProvider, useDiagramNodeLinks } from "@/lib/mermaid/diagram-node-links-context";
import { DIAGRAM_NODE_LINK_CAP } from "@/lib/mermaid/types";

function Harness() {
  const { links, addLink } = useDiagramNodeLinks();

  return (
    <div>
      <span data-testid="count">{links.length}</span>
      <button
        type="button"
        onClick={() =>
          addLink({
            diagramId: "d1",
            nodeId: `n${links.length}`,
            label: `Node ${links.length}`,
            neighborhood: { neighbors: [], edges: [] },
          })
        }
      >
        add
      </button>
    </div>
  );
}

describe("DiagramNodeLinksProvider", () => {
  test(`caps links at ${DIAGRAM_NODE_LINK_CAP}`, () => {
    const { getByRole, getByTestId } = render(
      <DiagramNodeLinksProvider>
        <Harness />
      </DiagramNodeLinksProvider>
    );

    const button = getByRole("button", { name: "add" });

    for (let i = 0; i < DIAGRAM_NODE_LINK_CAP + 2; i++) {
      fireEvent.click(button);
    }

    expect(getByTestId("count").textContent).toBe(String(DIAGRAM_NODE_LINK_CAP));
  });
});
