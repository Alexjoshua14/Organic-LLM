import { describeNeeds, type PlanStepView } from "./plan-model";
import { PlanStatusMark, PlanStatusWord } from "./plan-status";
import styles from "./Plan.module.css";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type PlanIndexProps = {
  steps: readonly PlanStepView[];
  selected: number;
  /** Id of the focus region the rows control. */
  focusId: string;
  labelId: string;
  /** Emit `step-<id>` morph identities (spatial browser). */
  morphIds?: boolean;
  onSelect: (index: number) => void;
};

/**
 * The whole plan as a map: every step, in order, with its status as a word, its time on a right-hand
 * rail, and — for a blocked step — the reason, in place. Rows are native buttons that move the focus.
 */
export function PlanIndex({
  steps,
  selected,
  focusId,
  labelId,
  morphIds,
  onSelect,
}: PlanIndexProps) {
  return (
    <div className={styles.indexWrap}>
      <p className={styles.sectionLabel} id={labelId}>
        All steps
      </p>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ol aria-labelledby={labelId} className={styles.index} role="list">
        {steps.map((view) => {
          const { step } = view;
          const needs = describeNeeds(view);

          return (
            <li
              key={view.key}
              className={styles.row}
              data-selected={view.index === selected}
              data-status={step.status}
              {...(morphIds ? { "data-morph-id": `step-${step.id}` } : {})}
            >
              <button
                aria-controls={focusId}
                aria-current={step.status === "now" ? "step" : undefined}
                aria-pressed={view.index === selected}
                className={styles.rowButton}
                type="button"
                onClick={() => onSelect(view.index)}
              >
                <span className={styles.rowNumber}>
                  <span className={styles.srOnly}>Step </span>
                  {view.number}
                </span>
                <PlanStatusMark status={step.status} />
                <span className={styles.rowBody}>
                  <span className={styles.rowTop}>
                    <span className={styles.rowLabel}>{step.label}</span>
                    {step.time ? <span className={styles.railTime}>{step.time}</span> : null}
                  </span>
                  <span className={styles.rowMeta}>
                    <PlanStatusWord status={step.status} />
                    {step.estimate ? <span>Estimate {step.estimate}</span> : null}
                    {needs ? <span>{needs}</span> : null}
                    {view.substeps.total > 0 ? (
                      <span>
                        {view.substeps.done} of {view.substeps.total} sub-steps done
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
              {step.status === "blocked" ? (
                <p className={styles.reason}>
                  <span className={styles.reasonLabel}>Why blocked</span>{" "}
                  {step.note ? (
                    <GenUIMarkdown inline>{step.note}</GenUIMarkdown>
                  ) : (
                    <span className={styles.reasonMissing}>No reason given.</span>
                  )}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
