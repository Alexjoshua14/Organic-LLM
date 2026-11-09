import { useId } from "react";

import { PlanFacts } from "./PlanFacts";
import { PlanLinks } from "./PlanLinks";
import { PlanSubsteps } from "./PlanSubsteps";
import { type PlanModel, type PlanStepView } from "./plan-model";
import styles from "./Plan.module.css";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type PlanFocusProps = {
  /** Id the row button points at with `aria-controls`. */
  id: string;
  /** Id of the row button that names this region. */
  labelledBy: string;
  plan: PlanModel;
  view: PlanStepView;
  /** Jump to another step (a dependency or dependant). */
  onSelect: (index: number) => void;
};

/**
 * The open step's detail, in place under its row: why it is blocked (or its note), the estimate
 * when the time rail is already taken, its checklist, and what it depends on / what needs it.
 * Nothing the collapsed row already shows is repeated here.
 */
export function PlanFocus({ id, labelledBy, plan, view, onSelect }: PlanFocusProps) {
  const uid = useId();
  const { step } = view;
  const hasSubsteps = view.substeps.total > 0;
  const hasLinks = view.dependsOn.length > 0 || view.neededBy.length > 0;

  return (
    <div aria-labelledby={labelledBy} className={styles.detail} id={id} role="region">
      {/* The row's rail shows the time, or the estimate when there is no time. */}
      <PlanFacts estimate={step.time ? step.estimate : undefined} />

      {step.status === "blocked" ? (
        <p className={styles.why}>
          <span className={styles.whyLabel}>Why blocked</span>{" "}
          {step.note ? (
            <GenUIMarkdown inline>{step.note}</GenUIMarkdown>
          ) : (
            <span className={styles.reasonMissing}>No reason given.</span>
          )}
        </p>
      ) : step.note ? (
        <p className={styles.note}>
          <GenUIMarkdown inline>{step.note}</GenUIMarkdown>
        </p>
      ) : null}

      {hasSubsteps || hasLinks ? (
        <div className={styles.detailGrid}>
          {hasSubsteps ? (
            <PlanSubsteps labelId={`${uid}-subs`} substeps={step.substeps ?? []} />
          ) : null}
          {hasLinks ? (
            <div className={styles.relations}>
              <PlanLinks
                items={view.dependsOn}
                label="Depends on"
                labelId={`${uid}-deps`}
                steps={plan.steps}
                onSelect={onSelect}
              />
              <PlanLinks
                items={view.neededBy}
                label="Needed by"
                labelId={`${uid}-needed`}
                steps={plan.steps}
                onSelect={onSelect}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
