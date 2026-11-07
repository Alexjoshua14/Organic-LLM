import type { PlanStepStatus } from "@/lib/schemas/gen-ui";

import styles from "./Plan.module.css";

/**
 * Status is carried three ways at once — a word, a distinct shape, and a tone — so no one channel
 * is load-bearing. The word is the schema's own vocabulary.
 */
export const PLAN_STATUS: Record<PlanStepStatus, { word: string; meaning: string }> = {
  done: { word: "Done", meaning: "Marked done" },
  now: { word: "Now", meaning: "In progress now" },
  next: { word: "Next", meaning: "Not started" },
  blocked: { word: "Blocked", meaning: "Blocked" },
};

export function PlanStatusWord({ status }: { status: PlanStepStatus }) {
  return (
    <span className={styles.statusWord} data-status={status}>
      {PLAN_STATUS[status].word}
    </span>
  );
}

/** Decorative: the adjacent <PlanStatusWord> is the accessible name. */
export function PlanStatusMark({ status }: { status: PlanStepStatus }) {
  return (
    <svg
      aria-hidden
      className={styles.mark}
      data-status={status}
      focusable="false"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <circle
        className={styles.markRing}
        cx="8"
        cy="8"
        fill={status === "done" ? "currentColor" : "none"}
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {status === "done" ? (
        <path
          d="M5.2 8.2 7.1 10.1 10.9 6"
          fill="none"
          stroke="var(--background)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      ) : null}
      {status === "now" ? <circle cx="8" cy="8" fill="currentColor" r="2.75" /> : null}
      {status === "blocked" ? (
        <path d="M5 8h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      ) : null}
    </svg>
  );
}
