"use client";

import type { PlanTimelineBlock } from "@/lib/schemas/gen-ui";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { PlanFocus } from "../plan/PlanFocus";
import { PlanIndex } from "../plan/PlanIndex";
import { PlanTally } from "../plan/PlanTally";
import { describeTally, derivePlan, type PlanModel } from "../plan/plan-model";
import { PLAN_STATUS, PlanStatusWord } from "../plan/plan-status";
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
        <p className={styles.summary}>{describeTally(plan.tally)}</p>
        {lead ? (
          <p className={styles.condensedLead} data-morph-id={`step-${lead.step.id}`}>
            <PlanStatusWord status={lead.step.status} />: {lead.step.label}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Plan as one frame: a counted summary, the step in focus, and an index of every step.
 * Selection is local view state only — nothing here completes, edits or persists a step.
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
  const uid = useId();
  const focusId = `${uid}-focus`;
  const [chosen, setChosen] = useState<number | null>(null);
  const focusRef = useRef<HTMLElement>(null);
  const revealRef = useRef(false);

  // Until the reader chooses, the focus follows the data (a plan that changes keeps pointing at
  // its current step). A stale choice — the plan got shorter — falls back to the lead.
  const selected = chosen !== null && chosen < plan.steps.length ? chosen : plan.lead;
  const view = plan.steps[selected] ?? plan.steps[0];

  useEffect(() => {
    if (!revealRef.current) return;
    revealRef.current = false;
    // When the focus sits above the index (narrow cards), bring it into view; no-op if visible.
    focusRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  if (!view) return null;

  const select = (index: number) => setChosen(index);
  const selectFromIndex = (index: number) => {
    revealRef.current = true;
    setChosen(index);
  };

  return (
    <div className={styles.root} data-partial={partial ? "true" : undefined}>
      <header className={styles.header}>
        <h3 className={styles.title} data-morph-id={morphIds ? "plan-title" : undefined}>
          {block.title}
        </h3>
        <p className={styles.summary}>{describeTally(plan.tally)}</p>
        <PlanTally
          morphId={morphIds ? "plan-progress" : undefined}
          statuses={block.steps.map((step) => step.status)}
        />
      </header>

      <div className={styles.layout}>
        <PlanFocus id={focusId} panelRef={focusRef} plan={plan} view={view} onSelect={select} />
        <PlanIndex
          focusId={focusId}
          labelId={`${uid}-index`}
          morphIds={morphIds}
          selected={selected}
          steps={plan.steps}
          onSelect={selectFromIndex}
        />
      </div>

      {chosen !== null ? (
        <p aria-live="polite" className={styles.srOnly} role="status">
          Showing step {view.index + 1} of {plan.steps.length}: {view.step.label},{" "}
          {PLAN_STATUS[view.step.status].meaning}
        </p>
      ) : null}
    </div>
  );
}

export function PlanTimeline({ block, partial, morphIds, variant = "full" }: PlanTimelineProps) {
  const plan = useMemo(() => derivePlan(block), [block]);

  if (variant === "condensed") return <CondensedPlan block={block} plan={plan} />;

  return <FullPlan block={block} morphIds={morphIds} partial={partial} plan={plan} />;
}
