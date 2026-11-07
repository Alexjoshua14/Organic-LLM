import styles from "./Plan.module.css";

type PlanFactsProps = {
  /** Clock anchor exactly as supplied ("7:30 PM", "Friday"). Never parsed. */
  time?: string;
  /** Duration estimate exactly as supplied ("1d"). An estimate, not a schedule; never summed. */
  estimate?: string;
};

/** Exact, labelled facts. Renders nothing when the step supplied none. */
export function PlanFacts({ time, estimate }: PlanFactsProps) {
  if (!time && !estimate) return null;

  return (
    <dl className={styles.facts}>
      {time ? (
        <div>
          <dt>Time</dt>
          <dd>{time}</dd>
        </div>
      ) : null}
      {estimate ? (
        <div>
          <dt>Estimate</dt>
          <dd>{estimate}</dd>
        </div>
      ) : null}
    </dl>
  );
}
