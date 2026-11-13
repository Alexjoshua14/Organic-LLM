import styles from "./Plan.module.css";

type PlanFactsProps = {
  /** Clock anchor exactly as supplied ("7:30 PM", "Friday"). Never parsed. */
  time?: string;
  /** Duration estimate exactly as supplied ("1d"). An estimate, not a schedule; never summed. */
  estimate?: string;
};

/**
 * Exact, labelled facts on one line. Renders nothing when the step supplied none. Each label and
 * value is a lead-in pair in one type role, like the blocked reason.
 */
export function PlanFacts({ time, estimate }: PlanFactsProps) {
  if (!time && !estimate) return null;

  return (
    <dl className={styles.facts}>
      {time ? (
        <div>
          <dt className={styles.leadLabel}>Time</dt>
          <dd className={styles.leadText}>{time}</dd>
        </div>
      ) : null}
      {estimate ? (
        <div>
          <dt className={styles.leadLabel}>Estimate</dt>
          <dd className={styles.leadText}>{estimate}</dd>
        </div>
      ) : null}
    </dl>
  );
}
