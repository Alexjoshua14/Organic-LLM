import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { RabbitHoleDrawerBranchGrid } from "@/components/rabbit-holes/mobile/RabbitHoleDrawerBranchGrid";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

const session: RabbitHoleSession = {
  sessionId: "sess-1",
  rootQuestion: "Root",
  path: [
    { nodeId: "root", label: "Root" },
    { nodeId: "child", label: "Child", parentNodeId: "root" },
  ],
  nodesById: {
    root: {
      id: "root",
      rawPrompt: "Root",
      userQuestion: "Root",
      keyTakeaways: ["a", "b", "c"],
      createdAt: new Date().toISOString(),
    },
    child: {
      id: "child",
      rawPrompt: "Child",
      userQuestion: "Child",
      keyTakeaways: ["a", "b", "c"],
      createdAt: new Date().toISOString(),
    },
  },
  activeNodeId: "child",
  edges: [],
  createdAt: new Date().toISOString(),
};

describe("RabbitHoleDrawerBranchGrid", () => {
  test("renders parent control when canGoBack", () => {
    const html = renderToStaticMarkup(
      <RabbitHoleDrawerBranchGrid
        activeNodeId="child"
        branches={[{ id: "b1", label: "Branch one" }]}
        canGoBack
        isLoading={false}
        session={session}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
      />
    );

    expect(html).toContain("Explore further");
    expect(html).toContain("Branch one");
    expect(html).toContain("grid-cols-6");
  });

  test("hides parent at root", () => {
    const html = renderToStaticMarkup(
      <RabbitHoleDrawerBranchGrid
        activeNodeId="root"
        branches={[{ id: "b1", label: "Only branch" }]}
        canGoBack={false}
        isLoading={false}
        session={session}
        onBranchClick={() => undefined}
        onNavigateBack={() => undefined}
      />
    );

    expect(html).not.toContain("writing-mode:vertical-rl");
    expect(html).toContain("col-span-6");
  });
});
