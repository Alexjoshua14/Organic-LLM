import { DiffCounts, DiffStatBar } from "./DiffCounts";
import styles from "./Diff.module.css";

type DiffStatStripProps = {
  fileCount: number;
  /** Changed files the author left out of the block. */
  moreFiles?: number;
  /** Totals; null when no file said how large its change was. */
  totals: { added: number; removed: number } | null;
  wrap: boolean;
  onToggleWrap: () => void;
  /** Present only when at least two files can open and close. */
  allOpen?: boolean;
  onToggleAll?: () => void;
};

/**
 * "3 files changed +42 −17" in words and numbers, with a decorative proportion bar and the two
 * view controls. The counts are what the app counted in the diffs — never what the model claimed.
 */
export function DiffStatStrip({
  fileCount,
  moreFiles,
  totals,
  wrap,
  onToggleWrap,
  allOpen,
  onToggleAll,
}: DiffStatStripProps) {
  return (
    <div className={styles.strip}>
      <span>
        {fileCount} {fileCount === 1 ? "file" : "files"} changed
        {moreFiles ? ` · ${moreFiles} more not shown` : ""}
      </span>
      {totals ? (
        <>
          <DiffCounts added={totals.added} removed={totals.removed} />
          <DiffStatBar added={totals.added} removed={totals.removed} />
        </>
      ) : null}
      <span className={styles.tools}>
        {onToggleAll ? (
          <button className={styles.btn} type="button" onClick={onToggleAll}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        ) : null}
        <button aria-pressed={wrap} className={styles.btn} type="button" onClick={onToggleWrap}>
          Wrap lines
        </button>
      </span>
    </div>
  );
}
