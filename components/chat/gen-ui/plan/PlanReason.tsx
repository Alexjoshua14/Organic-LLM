import styles from "./Plan.module.css";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

/**
 * A blocked step's reason: "Why blocked  Awaiting sign-off". One line in one type role — the
 * lead-in differs from the reason only in weight and colour — rendered in the same place whether
 * the row is open or not, so opening a blocked row never swaps the reason for a copy of itself.
 */
export function PlanReason({ note }: { note?: string }) {
  return (
    <div className={styles.reasonFold}>
      <div className={styles.foldClip}>
        <p className={styles.reason}>
          <span className={styles.leadLabel}>Why blocked</span>{" "}
          {note ? (
            <span className={styles.leadText}>
              <GenUIMarkdown inline>{note}</GenUIMarkdown>
            </span>
          ) : (
            <span className={`${styles.leadText} ${styles.leadMissing}`}>No reason given.</span>
          )}
        </p>
      </div>
    </div>
  );
}
