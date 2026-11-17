"use client";

import type { PlanTimelineBlock } from "@/lib/schemas/gen-ui";

import { useMemo, useState } from "react";

import { PlanIndex } from "../plan/PlanIndex";
import { PlanSummary } from "../plan/PlanSummary";
import { PlanTally } from "../plan/PlanTally";
import { describeTally, derivePlan, pickOpenIndex, type PlanModel } from "../plan/plan-model";
import { PlanStatusMark, PlanStatusWord } from "../plan/plan-status";
import styles from "../plan/Plan.module.css";

type PlanTimelineProps = {
  block: PlanTimelineBlock;
  partial?: boolean;
  /** Spatial browser: attach morph ids for sub-element transitions. */
  morphIds?: boolean;
  /** Condensed card for plans gallery slot measure. */
  variant?: "full" | "condensed";
};

function CondensedPlan({ block, plan }: { block: PlanTimelineBlock; plan: PlanModel }) {
  const lead = plan.steps[plan.lead];

  return (
    <div className={styles.root}>
      <div className={styles.condensed}>
        <p className={styles.condensedTitle} data-morph-id="plan-title">
          {block.title}
        </p>
        <PlanTally morphId="plan-progress" statuses={block.steps.map((step) => step.status)} />
        <PlanSummary text={describeTally(plan.tally)} />
        {lead ? (
          <p
            className={styles.condensedLead}
            data-morph-id={`step-${lead.step.id}`}
            data-status={lead.step.status}
          >
            <PlanStatusMark status={lead.step.status} />
            <span>
              <PlanStatusWord status={lead.step.status} />: {lead.step.label}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Plan as one list: a counted summary, then every step in order on a spine, with the current step
 * open in place. Opening a step is local view state only — nothing here completes, edits or
 * persists a step.
 */
function FullPlan({
  block,
  plan,
  partial,
  morphIds,
}: {
  block: PlanTimelineBlock;
  plan: PlanModel;
  partial?: boolean;
  morphIds?: boolean;
}) {
  // null: the reader has not chosen, so the open step follows the data (a streaming or updated
  // plan keeps pointing at its current step). -1: the reader closed every step.
  const [chosen, setChosen] = useState<number | null>(null);
  const open = chosen !== null && chosen < plan.steps.length ? chosen : pickOpenIndex(plan);

  return (
    <div className={styles.root} data-partial={partial ? "true" : undefined}>
      <header className={styles.header}>
        <h3 className={styles.title} data-morph-id={morphIds ? "plan-title" : undefined}>
          {block.title}
        </h3>
        <div className={styles.overview}>
          <PlanTally
            morphId={morphIds ? "plan-progress" : undefined}
            statuses={block.steps.map((step) => step.status)}
          />
          <PlanSummary text={describeTally(plan.tally)} />
        </div>
      </header>

      <PlanIndex
        morphIds={morphIds}
        open={open}
        plan={plan}
        onJump={setChosen}
        onToggle={(index) => setChosen(index === open ? -1 : index)}
      />
    </div>
  );
}

export function PlanTimeline({ block, partial, morphIds, variant = "full" }: PlanTimelineProps) {
  const plan = useMemo(() => derivePlan(block), [block]);

  if (variant === "condensed") return <CondensedPlan block={block} plan={plan} />;

  return <FullPlan block={block} morphIds={morphIds} partial={partial} plan={plan} />;
}
