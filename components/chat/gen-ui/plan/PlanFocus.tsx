import type { Ref } from "react";

import { useId } from "react";

import { PlanFacts } from "./PlanFacts";
import { PlanLinks } from "./PlanLinks";
import { PlanSubsteps } from "./PlanSubsteps";
import { type PlanModel, type PlanStepView } from "./plan-model";
import { PlanStatusMark, PlanStatusWord } from "./plan-status";
import styles from "./Plan.module.css";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type PlanFocusProps = {
  id: string;
  plan: PlanModel;
  view: PlanStepView;
  onSelect: (index: number) => void;
  panelRef?: Ref<HTMLElement>;
};

function StepNav({
  direction,
  target,
  onSelect,
}: {
  direction: "Previous" | "Next";
  target: PlanStepView | undefined;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      className={styles.nav}
      data-direction={direction}
      disabled={!target}
      type="button"
      onClick={() => target && onSelect(target.index)}
    >
      <span className={styles.navDirection}>{direction} step</span>
      <span className={styles.navLabel}>{target ? target.step.label : "None"}</span>
    </button>
  );
}

/**
 * One step, in full: where it sits, its exact facts, why it is blocked (or its note), its
 * checklist, what it depends on and what needs it. The first step to reach for is the current one.
 */
export function PlanFocus({ id, plan, view, onSelect, panelRef }: PlanFocusProps) {
  const uid = useId();
  const { step } = view;
  const alsoNow = plan.nowIndexes.filter((index) => index !== view.index);

  return (
    <section
      ref={panelRef}
      aria-labelledby={`${uid}-title`}
      className={styles.focus}
      data-status={step.status}
      id={id}
    >
      <p className={styles.kicker}>
        <PlanStatusMark status={step.status} />
        <PlanStatusWord status={step.status} />
        <span className={styles.kickerPosition}>
          Step {view.index + 1} of {plan.steps.length}
        </span>
      </p>
      <h4 className={styles.focusTitle} id={`${uid}-title`}>
        {step.label}
      </h4>

      <PlanFacts estimate={step.estimate} time={step.time} />

      {step.status === "blocked" ? (
        <div className={styles.blocker}>
          <p className={styles.blockerLabel}>Why it is blocked</p>
          {step.note ? (
            <p className={styles.note}>
              <GenUIMarkdown inline>{step.note}</GenUIMarkdown>
            </p>
          ) : (
            <p className={styles.reasonMissing}>No reason was given.</p>
          )}
        </div>
      ) : step.note ? (
        <p className={styles.note}>
          <GenUIMarkdown inline>{step.note}</GenUIMarkdown>
        </p>
      ) : null}

      <PlanSubsteps labelId={`${uid}-subs`} substeps={step.substeps ?? []} />

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
      {step.status === "now" ? (
        <PlanLinks
          items={alsoNow}
          label="Also now"
          labelId={`${uid}-also`}
          steps={plan.steps}
          onSelect={onSelect}
        />
      ) : null}

      <div aria-label="Move through the plan" className={styles.stepper} role="group">
        <StepNav direction="Previous" target={plan.steps[view.index - 1]} onSelect={onSelect} />
        <StepNav direction="Next" target={plan.steps[view.index + 1]} onSelect={onSelect} />
      </div>
    </section>
  );
}
