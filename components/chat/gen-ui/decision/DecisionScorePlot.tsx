import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import { scoreValueToNumeric } from "../lib/decision-matrix-math";
import styles from "../blocks/DecisionMatrix.module.css";

import { optionStyle } from "./option-style";
import { plotX, plotY } from "./plot-geometry";

import { formatMatrixScoreValue } from "@/lib/schemas/gen-ui";

type DecisionScorePlotProps = {
  block: DecisionMatrixBlock;
  id: string;
  activeCriterionId?: string;
  highlightedOption: string | null;
};

export function DecisionScorePlot({
  block,
  id,
  activeCriterionId,
  highlightedOption,
}: DecisionScorePlotProps) {
  return (
    <svg
      className={styles.plot}
      viewBox="0 0 600 168"
      role="img"
      aria-labelledby={`${id}-plot-title ${id}-plot-desc`}
    >
      <title id={`${id}-plot-title`}>
        Scores across {block.criteria.map((item) => item.label).join(", ")}
      </title>
      <desc id={`${id}-plot-desc`}>
        Each line represents an option from the legend. Select a criterion below to read every score
        and its evidence. Gaps mean unknown scores.
      </desc>
      {[1, 2, 3, 4, 5].map((score) => (
        <g key={score} className={styles.gridline}>
          <line x1="28" x2="572" y1={plotY(score)} y2={plotY(score)} />
          <text x="18" y={plotY(score) + 3.5} textAnchor="end">
            {score}
          </text>
        </g>
      ))}
      {block.criteria.map((item, index) => (
        <g key={item.id} className={styles.axis} data-active={item.id === activeCriterionId}>
          <line
            x1={plotX(index, block.criteria.length)}
            x2={plotX(index, block.criteria.length)}
            y1="20"
            y2="148"
          />
          <text x={plotX(index, block.criteria.length)} y="163" textAnchor="middle">
            {String(index + 1).padStart(2, "0")}
          </text>
        </g>
      ))}
      {block.options.map((option, optionIndex) => {
        let previousKnown = false;
        const path = block.criteria
          .map((item, index) => {
            const cell = block.scores[option.id]?.[item.id];

            if (!cell) {
              previousKnown = false;

              return "";
            }
            const command = previousKnown ? "L" : "M";

            previousKnown = true;

            return `${command}${plotX(index, block.criteria.length)},${plotY(scoreValueToNumeric(cell.value))}`;
          })
          .join(" ");

        return (
          <g
            key={option.id}
            className={styles.series}
            style={optionStyle(optionIndex)}
            data-dimmed={highlightedOption != null && highlightedOption !== option.id}
          >
            <path d={path} fill="none" strokeDasharray={optionIndex >= 5 ? "6 4" : undefined} />
            {block.criteria.map((item, index) => {
              const cell = block.scores[option.id]?.[item.id];

              return cell ? (
                <circle
                  key={item.id}
                  cx={plotX(index, block.criteria.length)}
                  cy={plotY(scoreValueToNumeric(cell.value))}
                  r={highlightedOption === option.id ? 5 : 3.5}
                >
                  <title>
                    {option.name} · {item.label}: {formatMatrixScoreValue(cell.value)}
                  </title>
                </circle>
              ) : null;
            })}
          </g>
        );
      })}
    </svg>
  );
}
