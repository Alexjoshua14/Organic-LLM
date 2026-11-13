import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

import { optionStyle } from "./option-style";
import { DecisionNotesDisclosure, DecisionSymbolLegend } from "./DecisionNotesDisclosure";

import { formatMatrixScoreValue } from "@/lib/schemas/gen-ui";

type DecisionCompactGridProps = {
  block: DecisionMatrixBlock;
};

/** Dense option×criterion score grid — no large plot. */
export function DecisionCompactGrid({ block }: DecisionCompactGridProps) {
  return (
    <div className={styles.compact}>
      <div className={styles.compactScroll}>
        <table className={styles.compactTable}>
          <caption className={styles.visuallyHidden}>
            Quick comparison of supplied scores by option and criterion
          </caption>
          <thead>
            <tr>
              <th scope="col">Option</th>
              {block.criteria.map((criterion) => (
                <th key={criterion.id} scope="col">
                  {criterion.label}
                  {criterion.weight != null ? (
                    <span className={styles.compactWeight}> · w{criterion.weight}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.options.map((option, index) => (
              <tr key={option.id} style={optionStyle(index)}>
                <th scope="row">
                  <span className={styles.swatch} aria-hidden="true">
                    {index + 1}
                  </span>
                  {option.name}
                </th>
                {block.criteria.map((criterion) => {
                  const cell = block.scores[option.id]?.[criterion.id];
                  const label = cell ? formatMatrixScoreValue(cell.value) : "unknown";

                  return (
                    <td
                      key={criterion.id}
                      aria-label={`${option.name}, ${criterion.label}: ${label}`}
                    >
                      {cell ? formatMatrixScoreValue(cell.value) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DecisionSymbolLegend block={block} />
      <DecisionNotesDisclosure block={block} summary="Option and criterion notes" />
    </div>
  );
}
