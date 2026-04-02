import { describe, expect, test } from "bun:test";

import { buildRawDiffPromptBlock, buildRawDiffSummary } from "@/lib/strata/raw-diff";

describe("buildRawDiffSummary", () => {
  test("returns stable no-change summary", () => {
    const summary = buildRawDiffSummary("same", "same");
    expect(summary).toBe("No raw-text differences detected.");
  });

  test("captures changed, added, and removed lines", () => {
    const summary = buildRawDiffSummary("a\nb\nc", "a\nb2");
    expect(summary).toContain("Changed lines: 1");
    expect(summary).toContain("Added lines: 0");
    expect(summary).toContain("Removed lines: 1");
    expect(summary).toContain("~ b => b2");
    expect(summary).toContain("- c");
  });
});

describe("buildRawDiffPromptBlock", () => {
  test("returns model-ready block with previous, current, and summary", () => {
    const block = buildRawDiffPromptBlock({
      previousRawText: "old",
      currentRawText: "new",
    });
    expect(block.block).toContain("Raw input delta context");
    expect(block.block).toContain("Previous generation raw text");
    expect(block.block).toContain("Current raw text");
    expect(block.block).toContain("Diff summary");
    expect(block.diffSummary).toContain("Line-level diff summary");
  });
});
