import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

type DecisionCriterionSelectorProps = {
  block: DecisionMatrixBlock;
  criterionId: string | undefined;
  evidenceId?: string;
  onSelect: (criterionId: string) => void;
};

export function DecisionCriterionSelector({
  block,
  criterionId,
  evidenceId,
  onSelect,
}: DecisionCriterionSelectorProps) {
  return (
    <div className={styles.criteria} role="group" aria-label="Inspect a criterion">
      {block.criteria.map((item, index) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === criterionId}
          aria-controls={evidenceId}
          onClick={() => onSelect(item.id)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
