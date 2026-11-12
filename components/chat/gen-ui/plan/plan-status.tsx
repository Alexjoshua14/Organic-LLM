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

/** Statuses that change what the reader does next; the rest are said by the mark (and to AT). */
export const PLAN_STATUS_NEEDS_WORD: Record<PlanStepStatus, boolean> = {
  done: false,
  now: true,
  next: false,
  blocked: true,
};

export function PlanStatusWord({
  status,
  hidden = false,
}: {
  status: PlanStepStatus;
  /** Keep the word for assistive tech only (the mark's shape carries it visually). */
  hidden?: boolean;
}) {
  return (
    <span className={hidden ? styles.srOnly : styles.statusWord} data-status={status}>
      {PLAN_STATUS[status].word}
    </span>
  );
}

/**
 * Decorative: the adjacent <PlanStatusWord> is the accessible name. Every glyph is always drawn
 * and only its opacity follows the status, so a status change cross-fades (Plan.module.css)
 * instead of swapping shapes.
 */
export function PlanStatusMark({ status }: { status: PlanStepStatus }) {
  const shown = (when: boolean) => (when ? 1 : 0);

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
        cx="8"
        cy="8"
        fill="currentColor"
        fillOpacity={shown(status === "done")}
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.2 8.2 7.1 10.1 10.9 6"
        fill="none"
        opacity={shown(status === "done")}
        stroke="var(--background)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="8" cy="8" fill="currentColor" opacity={shown(status === "now")} r="2.75" />
      <path
        d="M5 8h6"
        opacity={shown(status === "blocked")}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
