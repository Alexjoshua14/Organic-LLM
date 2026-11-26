import type { PlanStepStatus } from "@/lib/schemas/gen-ui";

import styles from "./Plan.module.css";

import { CompositionStroke } from "@/components/design-system/composition-bar";

type PlanTallyProps = {
  statuses: readonly PlanStepStatus[];
  /** Morph identity (`plan-progress`) shared by the condensed and full renders. */
  morphId?: string;
};

/** Steps not yet started: present, but not lit. */
const UNLIT = "color-mix(in oklab, var(--plan-tone) 35%, transparent)";

/**
 * One segment per step — a count of steps, not effort — each drawn with the app's one bar stroke
 * in its status tone (`--plan-tone`, set by `data-status`). Decorative: the summary sentence
 * beside it states the same counts in words.
 */
export function PlanTally({ statuses, morphId }: PlanTallyProps) {
  return (
    <div aria-hidden className={styles.tally} data-morph-id={morphId}>
      {statuses.map((status, index) => (
        <span key={index} className={styles.segment} data-status={status}>
          <CompositionStroke
            className="w-full"
            color={status === "next" ? UNLIT : "var(--plan-tone)"}
            glowColor={status === "next" ? "transparent" : undefined}
          />
        </span>
      ))}
    </div>
  );
}
