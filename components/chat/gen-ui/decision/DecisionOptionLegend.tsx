import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

import { optionStyle } from "./option-style";

type DecisionOptionLegendProps = {
  block: DecisionMatrixBlock;
  highlightedOption: string | null;
  onToggle: (optionId: string) => void;
};

export function DecisionOptionLegend({
  block,
  highlightedOption,
  onToggle,
}: DecisionOptionLegendProps) {
  return (
    <div className={styles.legend} role="group" aria-label="Highlight an option in the map">
      {block.options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          style={optionStyle(index)}
          aria-pressed={highlightedOption === option.id}
          onClick={() => onToggle(option.id)}
        >
          <span className={styles.swatch} aria-hidden="true">
            {index + 1}
          </span>
          {option.name}
        </button>
      ))}
    </div>
  );
}
