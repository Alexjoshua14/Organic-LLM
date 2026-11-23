import { expect, test } from "bun:test";

import { designerBlockShapes, parseDesignerBlock } from "@/lib/stage/block-shapes";

test("designer block shapes are compact enough to ride in the prompt", () => {
  const shapes = designerBlockShapes();

  expect(shapes).toContain("shopping-list");
  // Grows with designer-authored archetypes; keep under a soft budget for the stage prompt.
  expect(shapes.length).toBeLessThan(24_000);
});

test("block parsing names the fields that failed", () => {
  const bad = parseDesignerBlock(JSON.stringify({ type: "answer-card", version: 1, title: "x" }));

  expect(bad.ok).toBe(false);
  expect(!bad.ok && bad.reason).toContain("tldr");
  expect(parseDesignerBlock("{nope").ok).toBe(false);
  expect(parseDesignerBlock(JSON.stringify({ type: "research-report" })).ok).toBe(false);
});

test("a map's value shape reaches the prompt, so decision-matrix scores are cells, not numbers", () => {
  const matrix = designerBlockShapes()
    .split("\n")
    .find((line) => line.startsWith("decision-matrix:"))!;
  const scores = JSON.parse(matrix.slice("decision-matrix: ".length)).properties.scores;

  expect(scores.additionalProperties.additionalProperties.properties).toHaveProperty("value");
  expect(matrix).not.toContain('"additionalProperties":false');
});
