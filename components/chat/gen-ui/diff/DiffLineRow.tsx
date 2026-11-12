import { Fragment } from "react";

import { splitAtRange, type DisplayLine, type PlacedAnnotation } from "./diff-model";
import { DiffAnnotationNote } from "./DiffAnnotation";
import styles from "./Diff.module.css";

type DiffLineRowProps = {
  line: DisplayLine;
  annotations: PlacedAnnotation[];
  showOld: boolean;
  showNew: boolean;
  /** Total table columns, for rows that span them. */
  columns: number;
};

const SIGN = { add: "+", del: "−", context: "" } as const;
const SIGN_LABEL = { add: "Added line", del: "Removed line" } as const;

/** One code line's text; the changed span (if any) is emphasised by tint and weight. Text only. */
function CodeText({ line }: { line: DisplayLine }) {
  if (line.text === "") return null;

  const [before, changed, after] = splitAtRange(line.text, line.emphasis);

  if (changed === "") return <>{line.text}</>;

  return (
    <>
      {before}
      <span className={styles.emph} data-emphasis="true">
        {changed}
      </span>
      {after}
    </>
  );
}

/**
 * Gutters (old / new number), a +/− marker with an accessible name, then the code. Gutters and
 * marker are not selectable, so copying by selection yields the code alone.
 */
export function DiffLineRow({ line, annotations, showOld, showNew, columns }: DiffLineRowProps) {
  return (
    <Fragment>
      <tr className={styles.line} data-kind={line.kind}>
        {showOld ? <td className={styles.num}>{line.oldNo ?? ""}</td> : null}
        {showNew ? <td className={styles.num}>{line.newNo ?? ""}</td> : null}
        <td
          aria-label={line.kind === "context" ? undefined : SIGN_LABEL[line.kind]}
          className={styles.sign}
        >
          {SIGN[line.kind]}
        </td>
        <td className={styles.code}>
          <CodeText line={line} />
        </td>
      </tr>
      {line.noNewline ? (
        <tr className={styles.line} data-kind="meta">
          <td className={styles.sign} colSpan={columns - 1} />
          <td className={`${styles.code} ${styles.noEol}`}>No newline at end of file</td>
        </tr>
      ) : null}
      {annotations.map(({ key, annotation }) => (
        <tr key={key} className={styles.annotation}>
          <td colSpan={columns}>
            <div className={styles.sticky}>
              <DiffAnnotationNote annotation={annotation} />
            </div>
          </td>
        </tr>
      ))}
    </Fragment>
  );
}
