import type { PlanStepStatus } from "@/lib/schemas/gen-ui";

import styles from "./Plan.module.css";

type PlanTallyProps = {
  statuses: readonly PlanStepStatus[];
  /** Morph identity (`plan-progress`) shared by the condensed and full renders. */
  morphId?: string;
};

/**
 * One segment per step — a count of steps, not effort. Each status has its own fill pattern so it
 * survives greyscale. Decorative: the summary sentence beside it states the same counts in words.
 */
export function PlanTally({ statuses, morphId }: PlanTallyProps) {
  return (
    <div aria-hidden className={styles.tally} data-morph-id={morphId}>
      {statuses.map((status, index) => (
        <span key={index} className={styles.segment} data-status={status} />
      ))}
    </div>
  );
}
