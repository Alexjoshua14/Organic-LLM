import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

import { decisionHasMissing, decisionHasSymbols } from "./score-flags";

type DecisionCaptionProps = {
  block: DecisionMatrixBlock;
  /** Override the lead sentence (default: select a dimension). */
  lead?: string;
};

export function DecisionCaption({ block, lead }: DecisionCaptionProps) {
  const hasSymbols = decisionHasSymbols(block);
  const hasMissing = decisionHasMissing(block);

  return (
    <p className={styles.caption}>
      {lead ?? "Select a dimension to inspect the evidence."}
      {hasSymbols
        ? " Map positions: ✓ = 5, ~ = 3, ✗ = 1; original values appear below."
        : " Values are supplied scores, not measured quantities."}
      {hasMissing ? " Gaps are unknown; no score is inferred." : ""}
    </p>
  );
}
