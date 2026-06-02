import type { DecisionMatrixBlock, MatrixScoreValue } from "@/lib/schemas/gen-ui";

export function scoreValueToNumeric(value: MatrixScoreValue): number {
  if (typeof value === "number") return value;
  switch (value) {
    case "✓":
      return 5;
    case "✗":
      return 1;
    case "~":
      return 3;
    default:
      return 3;
  }
}

/** Weighted totals per option id when any criterion has weight. */
export function computeWeightedTotals(block: DecisionMatrixBlock): Record<string, number> | null {
  const weights = block.criteria.map((c) => c.weight ?? 1);
  const hasExplicitWeights = block.criteria.some((c) => c.weight != null);
  if (!hasExplicitWeights) return null;

  const totals: Record<string, number> = {};
  for (const opt of block.options) {
    let sum = 0;
    let weightSum = 0;
    for (let i = 0; i < block.criteria.length; i++) {
      const c = block.criteria[i]!;
      const w = weights[i]!;
      const cell = block.scores[opt.id]?.[c.id];
      if (!cell) continue;
      sum += scoreValueToNumeric(cell.value) * w;
      weightSum += w;
    }
    totals[opt.id] = weightSum > 0 ? sum / weightSum : 0;
  }
  return totals;
}
