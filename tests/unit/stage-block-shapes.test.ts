import { expect, test } from "bun:test";

import { designerBlockShapes, parseDesignerBlock } from "@/lib/stage/block-shapes";

test("designer block shapes are compact enough to ride in the prompt", () => {
  const shapes = designerBlockShapes();

  expect(shapes).toContain("shopping-list");
  expect(shapes.length).toBeLessThan(16_000);
});

test("block parsing names the fields that failed", () => {
  const bad = parseDesignerBlock(JSON.stringify({ type: "answer-card", version: 1, title: "x" }));

  expect(bad.ok).toBe(false);
  expect(!bad.ok && bad.reason).toContain("tldr");
  expect(parseDesignerBlock("{nope").ok).toBe(false);
  expect(parseDesignerBlock(JSON.stringify({ type: "research-report" })).ok).toBe(false);
});
