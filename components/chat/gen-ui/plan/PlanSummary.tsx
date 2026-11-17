import { useEffect, useRef } from "react";

import styles from "./Plan.module.css";

/**
 * The counted summary ("1 of 4 steps done · 1 now"). A new count replaces the line, and that new
 * line settles in (Plan.module.css); the first paint never animates.
 */
export function PlanSummary({ text }: { text: string }) {
  const painted = useRef(false);

  useEffect(() => {
    painted.current = true;
  }, []);

  return (
    <p key={text} className={styles.summary} data-changed={painted.current || undefined}>
      {text}
    </p>
  );
}
