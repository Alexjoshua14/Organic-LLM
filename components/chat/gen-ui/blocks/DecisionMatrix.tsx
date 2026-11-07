"use client";

import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import { useId, useState } from "react";

import {
  DecisionCaption,
  DecisionCompactGrid,
  DecisionCriterionSelector,
  DecisionEvidenceList,
  DecisionHeadToHead,
  DecisionOptionLegend,
  DecisionOptionStack,
  DecisionQuestion,
  DecisionRecommendation,
  DecisionScorePlot,
} from "../decision";

import styles from "./DecisionMatrix.module.css";

export type DecisionArrangement =
  | "overview"
  | "recommendation"
  | "evidence"
  | "head-to-head"
  | "compact";

type DecisionMatrixProps = {
  block: DecisionMatrixBlock;
  partial?: boolean;
  /** Local React composition only — not a schema/tool field. Defaults to overview. */
  arrangement?: DecisionArrangement;
};

function useDecisionLens(block: DecisionMatrixBlock) {
  const [criterionId, setCriterionId] = useState(block.criteria[0]?.id);
  const [focusedOption, setFocusedOption] = useState<string | null>(null);
  const highlightedOption = block.options.some((option) => option.id === focusedOption)
    ? focusedOption
    : null;
  const criterion = block.criteria.find((item) => item.id === criterionId) ?? block.criteria[0];

  return {
    criterionId: criterion?.id,
    setCriterionId,
    highlightedOption,
    toggleHighlight: (optionId: string) =>
      setFocusedOption((current) => (current === optionId ? null : optionId)),
    criterion,
  };
}

function OverviewArrangement({
  block,
  partial,
  id,
}: {
  block: DecisionMatrixBlock;
  partial?: boolean;
  id: string;
}) {
  const { criterionId, setCriterionId, highlightedOption, toggleHighlight, criterion } =
    useDecisionLens(block);
  const evidenceId = `${id}-evidence`;

  return (
    <>
      <header className={styles.header}>
        <DecisionQuestion
          id={`${id}-question`}
          question={block.question}
          optionCount={block.options.length}
        />
        <DecisionRecommendation block={block} />
      </header>

      <div className={styles.body}>
        <div className={styles.map}>
          <div className={styles.mapMeta}>
            <span>Scores, 1–5 · not a ranking</span>
          </div>
          <DecisionOptionLegend
            block={block}
            highlightedOption={highlightedOption}
            onToggle={toggleHighlight}
          />
          <DecisionScorePlot
            block={block}
            id={id}
            activeCriterionId={criterionId}
            highlightedOption={highlightedOption}
          />
          <DecisionCriterionSelector
            block={block}
            criterionId={criterionId}
            evidenceId={evidenceId}
            onSelect={setCriterionId}
          />
          <DecisionCaption block={block} />
        </div>

        {criterion ? (
          <DecisionEvidenceList
            block={block}
            criterion={criterion}
            id={evidenceId}
            partial={partial}
          />
        ) : null}
      </div>
    </>
  );
}

function RecommendationArrangement({
  block,
  partial,
  id,
}: {
  block: DecisionMatrixBlock;
  partial?: boolean;
  id: string;
}) {
  const { criterionId, setCriterionId, criterion } = useDecisionLens(block);
  const evidenceId = `${id}-evidence`;

  return (
    <>
      <header className={styles.header}>
        <DecisionQuestion
          id={`${id}-question`}
          question={block.question}
          optionCount={block.options.length}
        />
        <DecisionRecommendation block={block} lead />
      </header>

      <div className={styles.bodyStack}>
        <DecisionOptionStack block={block} />
        <div className={styles.recommendationEvidence}>
          <DecisionCriterionSelector
            block={block}
            criterionId={criterionId}
            evidenceId={evidenceId}
            onSelect={setCriterionId}
          />
          {criterion ? (
            <DecisionEvidenceList
              block={block}
              criterion={criterion}
              id={evidenceId}
              partial={partial}
            />
          ) : null}
          <DecisionCaption
            block={block}
            lead="Inspect one criterion at a time — no shape chart in this arrangement."
          />
        </div>
      </div>
    </>
  );
}

function EvidenceArrangement({
  block,
  partial,
  id,
}: {
  block: DecisionMatrixBlock;
  partial?: boolean;
  id: string;
}) {
  const { criterionId, setCriterionId, highlightedOption, toggleHighlight, criterion } =
    useDecisionLens(block);
  const evidenceId = `${id}-evidence`;

  return (
    <>
      <header className={styles.header}>
        <DecisionQuestion
          id={`${id}-question`}
          question={block.question}
          optionCount={block.options.length}
        />
        <DecisionRecommendation block={block} />
      </header>

      <div className={styles.bodyEvidence}>
        <div className={styles.evidenceLead}>
          <DecisionCriterionSelector
            block={block}
            criterionId={criterionId}
            evidenceId={evidenceId}
            onSelect={setCriterionId}
          />
          {criterion ? (
            <DecisionEvidenceList
              block={block}
              criterion={criterion}
              id={evidenceId}
              partial={partial}
              notesProminent
            />
          ) : null}
          <DecisionCaption
            block={block}
            lead="Evidence notes lead; the score map is optional below."
          />
        </div>

        <details className={styles.plotDisclosure}>
          <summary>Score map (optional)</summary>
          <div className={styles.map}>
            <div className={styles.mapMeta}>
              <span>Scores, 1–5 · not a ranking</span>
            </div>
            <DecisionOptionLegend
              block={block}
              highlightedOption={highlightedOption}
              onToggle={toggleHighlight}
            />
            <DecisionScorePlot
              block={block}
              id={id}
              activeCriterionId={criterionId}
              highlightedOption={highlightedOption}
            />
          </div>
        </details>
      </div>
    </>
  );
}

function HeadToHeadArrangement({
  block,
  partial,
  id,
}: {
  block: DecisionMatrixBlock;
  partial?: boolean;
  id: string;
}) {
  return (
    <>
      <header className={styles.header}>
        <DecisionQuestion
          id={`${id}-question`}
          question={block.question}
          optionCount={block.options.length}
        />
        <DecisionRecommendation block={block} />
      </header>
      <div className={styles.bodyStack}>
        <DecisionHeadToHead block={block} partial={partial} />
      </div>
    </>
  );
}

function CompactArrangement({ block, id }: { block: DecisionMatrixBlock; id: string }) {
  return (
    <>
      <header className={styles.header}>
        <DecisionQuestion
          id={`${id}-question`}
          question={block.question}
          optionCount={block.options.length}
        />
        <DecisionRecommendation block={block} />
      </header>
      <div className={styles.bodyStack}>
        <DecisionCompactGrid block={block} />
      </div>
    </>
  );
}

/** Compare options across criteria; `arrangement` only changes local React composition. */
export function DecisionMatrix({ block, partial, arrangement = "overview" }: DecisionMatrixProps) {
  const id = useId();

  return (
    <section
      className={styles.root}
      data-arrangement={arrangement}
      aria-labelledby={`${id}-question`}
    >
      {arrangement === "overview" ? (
        <OverviewArrangement block={block} partial={partial} id={id} />
      ) : null}
      {arrangement === "recommendation" ? (
        <RecommendationArrangement block={block} partial={partial} id={id} />
      ) : null}
      {arrangement === "evidence" ? (
        <EvidenceArrangement block={block} partial={partial} id={id} />
      ) : null}
      {arrangement === "head-to-head" ? (
        <HeadToHeadArrangement block={block} partial={partial} id={id} />
      ) : null}
      {arrangement === "compact" ? <CompactArrangement block={block} id={id} /> : null}
    </section>
  );
}
