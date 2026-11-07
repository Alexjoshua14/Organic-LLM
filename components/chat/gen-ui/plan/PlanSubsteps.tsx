import type { PlanTimelineStep } from "@/lib/schemas/gen-ui";

import styles from "./Plan.module.css";

type Substep = NonNullable<PlanTimelineStep["substeps"]>[number];

type PlanSubstepsProps = {
  substeps: readonly Substep[];
  labelId: string;
};

/**
 * Read-only: the marks show what the plan says, they are not controls and nothing here persists.
 * A substep with no `done` is "not marked done", not "unknown".
 */
export function PlanSubsteps({ substeps, labelId }: PlanSubstepsProps) {
  if (substeps.length === 0) return null;

  const done = substeps.filter((sub) => sub.done === true).length;

  return (
    <div>
      <p className={styles.sectionLabel} id={labelId}>
        Sub-steps · {done} of {substeps.length} marked done
      </p>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul aria-labelledby={labelId} className={styles.substeps} role="list">
        {substeps.map((sub, index) => (
          <li key={index} data-done={sub.done === true}>
            <svg
              aria-hidden
              className={styles.subMark}
              focusable="false"
              height="14"
              viewBox="0 0 14 14"
              width="14"
            >
              <rect
                fill={sub.done ? "currentColor" : "none"}
                height="11"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.4"
                width="11"
                x="1.5"
                y="1.5"
              />
              {sub.done ? (
                <path
                  d="M4.4 7.2 6.2 9 9.6 5.3"
                  fill="none"
                  stroke="var(--background)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              ) : null}
            </svg>
            <span className={styles.subLabel}>
              <span className={styles.srOnly}>{sub.done ? "Done: " : "Not marked done: "}</span>
              {sub.label}
            </span>
            {sub.time ? <span className={styles.railTime}>{sub.time}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
