import { useEffect, useId, useRef } from "react";

import { PlanFocus } from "./PlanFocus";
import { describeNeeds, stepHasDetail, type PlanModel, type PlanStepView } from "./plan-model";
import { PLAN_STATUS_NEEDS_WORD, PlanStatusMark, PlanStatusWord } from "./plan-status";
import styles from "./Plan.module.css";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type PlanIndexProps = {
  plan: PlanModel;
  /** Index of the open step, or -1 when every row is collapsed. */
  open: number;
  /** Emit `step-<id>` morph identities (spatial browser). */
  morphIds?: boolean;
  /** Open (or, for the open row, close) a step. */
  onToggle: (index: number) => void;
  /** Open a step reached through a relationship link; focus moves to its row. */
  onJump: (index: number) => void;
};

/** Time, else estimate: the one exact string a row lines up on the right. */
function Rail({ view }: { view: PlanStepView }) {
  const { time, estimate } = view.step;

  if (time) {
    return (
      <span className={styles.rail}>
        <span className={styles.srOnly}>Time </span>
        {time}
      </span>
    );
  }

  if (estimate) {
    return (
      <span className={styles.rail}>
        <span aria-hidden>Est. </span>
        <span className={styles.srOnly}>Estimate </span>
        {estimate}
      </span>
    );
  }

  return null;
}

/** Collapsed-row extras, only those that carry information the line above does not. */
function metaFor(view: PlanStepView): string[] {
  const { step } = view;
  const needs = describeNeeds(view);
  const meta: string[] = [];

  if (step.time && step.estimate) meta.push(`Estimate ${step.estimate}`);
  if (needs) meta.push(needs);
  if (view.substeps.total > 0) {
    meta.push(`${view.substeps.done} of ${view.substeps.total} sub-steps done`);
  }

  return meta;
}

function RowLine({ view }: { view: PlanStepView }) {
  const { step } = view;

  return (
    <>
      <PlanStatusMark status={step.status} />
      <span className={styles.rowNumber}>
        <span className={styles.srOnly}>Step </span>
        {view.number}
      </span>
      <span className={styles.rowLine}>
        <span className={styles.rowLabel}>
          {step.label}{" "}
          <PlanStatusWord hidden={!PLAN_STATUS_NEEDS_WORD[step.status]} status={step.status} />
        </span>
        <Rail view={view} />
      </span>
    </>
  );
}

/**
 * The plan as one ordered list on a spine: every step is a single line (mark, number, label, a
 * status word only where it changes what to do, the time on a right rail). The open step expands
 * in place; a blocked step's reason is always visible. Rows with detail are native buttons.
 */
export function PlanIndex({ plan, open, morphIds, onToggle, onJump }: PlanIndexProps) {
  const uid = useId();
  const rowRefs = useRef(new Map<number, HTMLButtonElement>());
  const pendingFocus = useRef<number | null>(null);

  // A jump unmounts the detail that held the link; hand focus to the row that opened instead.
  useEffect(() => {
    const target = pendingFocus.current;

    if (target === null) return;
    pendingFocus.current = null;
    rowRefs.current.get(target)?.focus();
  }, [open]);

  const jump = (index: number) => {
    pendingFocus.current = index;
    onJump(index);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset
    <ol aria-label="All steps" className={styles.index} role="list">
      {plan.steps.map((view) => {
        const { step } = view;
        const interactive = stepHasDetail(view);
        const isOpen = interactive && view.index === open;
        const buttonId = `${uid}-row-${view.index}`;
        const detailId = `${uid}-detail-${view.index}`;
        const meta = isOpen ? [] : metaFor(view);
        const metaLine =
          meta.length > 0 ? (
            <span className={styles.rowMeta}>
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
          ) : null;

        return (
          <li
            key={view.key}
            className={styles.row}
            data-interactive={interactive}
            data-open={isOpen}
            data-status={step.status}
            {...(morphIds ? { "data-morph-id": `step-${step.id}` } : {})}
          >
            {interactive ? (
              <button
                ref={(node) => {
                  if (node) rowRefs.current.set(view.index, node);
                  else rowRefs.current.delete(view.index);
                }}
                aria-controls={isOpen ? detailId : undefined}
                aria-current={step.status === "now" ? "step" : undefined}
                aria-expanded={isOpen}
                className={styles.rowHead}
                id={buttonId}
                type="button"
                onClick={() => onToggle(view.index)}
              >
                <RowLine view={view} />
                {metaLine}
              </button>
            ) : (
              <div
                aria-current={step.status === "now" ? "step" : undefined}
                className={styles.rowHead}
              >
                <RowLine view={view} />
                {metaLine}
              </div>
            )}
            {step.status === "blocked" && !isOpen ? (
              <p className={styles.reason}>
                <span className={styles.srOnly}>Why blocked: </span>
                {step.note ? (
                  <GenUIMarkdown inline>{step.note}</GenUIMarkdown>
                ) : (
                  <span className={styles.reasonMissing}>No reason given.</span>
                )}
              </p>
            ) : null}
            {isOpen ? (
              <PlanFocus
                id={detailId}
                labelledBy={buttonId}
                plan={plan}
                view={view}
                onSelect={jump}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
