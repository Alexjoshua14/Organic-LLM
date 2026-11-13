import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type DecisionRecommendationProps = {
  block: DecisionMatrixBlock;
  /** Emphasize recommendation as the lead surface. */
  lead?: boolean;
};

export function DecisionRecommendation({ block, lead }: DecisionRecommendationProps) {
  if (!block.recommendation) return null;

  const recommendation = block.options.find(
    (option) => option.id === block.recommendation?.optionId
  );

  return (
    <div className={lead ? styles.recommendationLead : styles.recommendation}>
      <p className={styles.recLabel}>
        Aion’s recommendation{recommendation ? ` · ${recommendation.name}` : ""}
      </p>
      <GenUIMarkdown>{block.recommendation.rationale}</GenUIMarkdown>
    </div>
  );
}
