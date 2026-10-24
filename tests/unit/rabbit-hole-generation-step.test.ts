import { describe, expect, test } from "bun:test";

import { incompleteGenerationStep } from "@/lib/rabbit-holes/generation-step";

describe("incompleteGenerationStep", () => {
  test("starts at sources when the node has none", () => {
    expect(incompleteGenerationStep({ articleHtml: "" })).toBe("sources");
  });

  test("resumes at the article when sources already landed", () => {
    expect(
      incompleteGenerationStep({
        sources: [{ id: "s1" }],
        articleHtml: "  ",
      })
    ).toBe("article");
  });

  test("is done when the article and branches exist", () => {
    expect(
      incompleteGenerationStep({
        sources: [{ id: "s1" }],
        articleHtml: "<p>Done</p>",
        branchSuggestions: [{ id: "b1" }],
      })
    ).toBeNull();
  });
});
