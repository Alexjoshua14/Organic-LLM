import type { ResolvableAnnotation } from "@/lib/diff/resolve-file";

import { displayText } from "./diff-model";
import styles from "./Diff.module.css";

const KIND_WORD = { note: "Note", issue: "Issue", suggestion: "Suggestion" } as const;

/**
 * A comment on a line (or on the file). The kind is a word and a border style — solid, double,
 * dashed — so it survives without colour. Text only: model prose is never parsed as markup.
 */
export function DiffAnnotationNote({
  annotation,
  where,
}: {
  annotation: ResolvableAnnotation;
  /** Where it was meant to go, for a comment shown away from its line. */
  where?: string;
}) {
  const kind = annotation.kind ?? "note";

  return (
    <div className={styles.note} data-kind={kind}>
      <span className={styles.noteKind}>
        {KIND_WORD[kind]}
        {where ? ` · ${where}` : ""}
      </span>
      <p className={styles.noteText}>{displayText(annotation.text)}</p>
    </div>
  );
}

/** Where an unplaced comment was meant to go, in words. */
export function describeAnnotationTarget(annotation: ResolvableAnnotation): string {
  if (annotation.line !== undefined) {
    return `Line ${annotation.line}${annotation.side === "old" ? " (before the change)" : ""}`;
  }

  if (annotation.match) return `Near “${displayText(annotation.match)}”`;

  return "This file";
}
