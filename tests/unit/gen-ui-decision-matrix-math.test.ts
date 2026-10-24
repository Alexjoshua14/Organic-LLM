import { describe, expect, test } from "bun:test";

import { computeWeightedTotals, scoreValueToNumeric } from "@/components/chat/gen-ui/lib/decision-matrix-math";
import { FIXTURE_DECISION_MATRIX } from "@/lib/schemas/gen-ui/fixtures";

describe("decision-matrix-math", () => {
  test("scoreValueToNumeric maps symbols", () => {
    expect(scoreValueToNumeric("✓")).toBe(5);
    expect(scoreValueToNumeric("✗")).toBe(1);
    expect(scoreValueToNumeric(4)).toBe(4);
  });

  test("computeWeightedTotals returns per-option averages", () => {
    const totals = computeWeightedTotals(FIXTURE_DECISION_MATRIX);
    expect(totals).not.toBeNull();
    expect(totals!.pg).toBeGreaterThan(0);
    expect(totals!.sqlite).toBeGreaterThan(0);
  });
});
