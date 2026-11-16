import type { DiffFileStatus } from "@/lib/diff/parse-unified";

import styles from "./Diff.module.css";

/** Status is a word and a distinct shape (plus / dot / minus / arrow); colour only reinforces. */
export const DIFF_STATUS: Record<DiffFileStatus, { word: string }> = {
  added: { word: "Added" },
  modified: { word: "Modified" },
  deleted: { word: "Deleted" },
  renamed: { word: "Renamed" },
};

export function DiffStatusWord({ status }: { status: DiffFileStatus }) {
  return (
    <span className={styles.statusWord} data-status={status}>
      {DIFF_STATUS[status].word}
    </span>
  );
}

/** Decorative: the adjacent <DiffStatusWord> is the accessible name. */
export function DiffStatusMark({ status }: { status: DiffFileStatus }) {
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
      <rect
        fill="none"
        height="12.5"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
        width="12.5"
        x="1.75"
        y="1.75"
      />
      {status === "added" ? (
        <path
          d="M8 5v6M5 8h6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      ) : null}
      {status === "deleted" ? (
        <path
          d="M5 8h6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      ) : null}
      {status === "modified" ? <circle cx="8" cy="8" fill="currentColor" r="2" /> : null}
      {status === "renamed" ? (
        <path
          d="M4.5 8h6.5M8.5 5.5 11 8l-2.5 2.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      ) : null}
    </svg>
  );
}
