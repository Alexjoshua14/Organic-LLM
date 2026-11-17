import type { DiffRow } from "./diff-model";

import styles from "./Diff.module.css";

/** `@@ -10,6 +10,8 @@ functionName` — numbers recomputed from the lines, section text as written. */
export function DiffHunkHead({
  row,
  columns,
}: {
  row: Extract<DiffRow, { type: "hunk" }>;
  columns: number;
}) {
  return (
    <tr className={styles.hunkHead}>
      <td colSpan={columns}>
        <div className={styles.sticky}>
          <span>{row.label}</span>
          {row.section ? <span className={styles.hunkSection}>{row.section}</span> : null}
        </div>
      </td>
    </tr>
  );
}

/** Lines the diff does not show between (or before) hunks: counted, not expandable. */
export function DiffGap({
  row,
  columns,
}: {
  row: Extract<DiffRow, { type: "gap" }>;
  columns: number;
}) {
  const lines = row.count === 1 ? "line" : "lines";

  return (
    <tr className={styles.gap}>
      <td colSpan={columns}>
        <div className={styles.sticky}>
          {row.count} unchanged {lines} {row.where === "before" ? "above" : "not shown"}
        </div>
      </td>
    </tr>
  );
}

/** Long unchanged runs folded; a native button reveals or re-folds them. */
export function DiffFoldToggle({
  count,
  expanded,
  columns,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  columns: number;
  onToggle: () => void;
}) {
  const lines = count === 1 ? "line" : "lines";

  return (
    <tr className={styles.fold}>
      <td colSpan={columns}>
        <div className={styles.sticky}>
          <button aria-expanded={expanded} className={styles.btn} type="button" onClick={onToggle}>
            {expanded ? `Hide ${count} unchanged ${lines}` : `Show ${count} unchanged ${lines}`}
          </button>
        </div>
      </td>
    </tr>
  );
}
