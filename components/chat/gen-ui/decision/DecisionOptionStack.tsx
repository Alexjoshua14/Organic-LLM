import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

import { optionStyle } from "./option-style";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type DecisionOptionStackProps = {
  block: DecisionMatrixBlock;
  /** Mark the recommended option without implying a score winner. */
  markRecommendation?: boolean;
};

/** Option list with notes — used when recommendation leads and the chart is optional. */
export function DecisionOptionStack({
  block,
  markRecommendation = true,
}: DecisionOptionStackProps) {
  const recommendedId = block.recommendation?.optionId;

  return (
    <ul className={styles.optionStack}>
      {block.options.map((option, index) => {
        const isRecommended = markRecommendation && option.id === recommendedId;

        return (
          <li key={option.id} style={optionStyle(index)}>
            <div className={styles.optionName}>
              <span className={styles.swatch} aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <strong>
                  {option.name}
                  {isRecommended ? <span className={styles.recChip}> · model pick</span> : null}
                </strong>
                {option.note ? (
                  <div className={styles.optionNote}>
                    <GenUIMarkdown inline>{option.note}</GenUIMarkdown>
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
