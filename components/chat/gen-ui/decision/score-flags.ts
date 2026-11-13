import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

export function decisionHasSymbols(block: DecisionMatrixBlock): boolean {
  return block.options.some((option) =>
    block.criteria.some((item) => {
      const value = block.scores[option.id]?.[item.id]?.value;

      return value != null && typeof value !== "number";
    })
  );
}

export function decisionHasMissing(block: DecisionMatrixBlock): boolean {
  return block.options.some((option) =>
    block.criteria.some((item) => !block.scores[option.id]?.[item.id])
  );
}
