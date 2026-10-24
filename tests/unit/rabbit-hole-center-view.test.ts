import { describe, expect, test } from "bun:test";

import { resolveRabbitHoleCenterView } from "@/lib/rabbit-holes/centerViewState";

const base = {
  loadingPrevious: false,
  isAnalyzingSource: false,
  selectedSourceId: null,
  hasSourceAnalysis: false,
  isBranch: false,
};

describe("resolveRabbitHoleCenterView", () => {
  test("treats an active node with no article as generating", () => {
    expect(
      resolveRabbitHoleCenterView({
        ...base,
        activeNode: { id: "node-1", articleHtml: "" },
      })
    ).toEqual({ kind: "generating_new_node", variant: "initial" });
  });

  test("uses the branch loader when the empty node is not the root", () => {
    expect(
      resolveRabbitHoleCenterView({
        ...base,
        isBranch: true,
        activeNode: { id: "node-2", articleHtml: null },
      })
    ).toEqual({ kind: "generating_new_node", variant: "branch" });
  });

  test("loads the article only when html is present", () => {
    expect(
      resolveRabbitHoleCenterView({
        ...base,
        activeNode: { id: "node-1", articleHtml: "<p>Ready</p>" },
      })
    ).toEqual({ kind: "article_loaded", nodeId: "node-1" });
  });

  test("stays empty when nothing is selected", () => {
    expect(resolveRabbitHoleCenterView({ ...base, activeNode: null })).toEqual({ kind: "empty" });
  });
});
