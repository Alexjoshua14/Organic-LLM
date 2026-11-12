import { Fragment } from "react";

import { type DisplayLine, type PlacedAnnotation } from "./diff-model";
import { DiffAnnotationNote } from "./DiffAnnotation";
import styles from "./Diff.module.css";

import { CODE_EMPHASIS_CLASS, CodeMetaRow, CodeRow } from "@/components/shared/code/code-table";
import { HighlightedText } from "@/components/shared/code-highlight";

type DiffLineRowProps = {
  line: DisplayLine;
  annotations: PlacedAnnotation[];
  showOld: boolean;
  showNew: boolean;
  /** Total table columns, for rows that span them. */
  columns: number;
  /** Fence-style language of the file, for syntax colour; undefined renders plain text. */
  language?: string;
};

const SIGN = { add: "+", del: "−", context: "" } as const;
const SIGN_LABEL = { add: "Added line", del: "Removed line" } as const;

/**
 * One code line's text as syntax tokens; the changed span (if any) is emphasised by tint and
 * weight. Text only.
 */
function CodeText({ line, language }: { line: DisplayLine; language: string | undefined }) {
  if (line.text === "") return null;

  return (
    <HighlightedText
      emphasis={line.emphasis}
      emphasisClassName={CODE_EMPHASIS_CLASS}
      language={language}
      text={line.text}
    />
  );
}

/**
 * Gutters (old / new number), a +/− marker with an accessible name, then the code. Gutters and
 * marker are not selectable, so copying by selection yields the code alone.
 */
export function DiffLineRow({
  line,
  annotations,
  showOld,
  showNew,
  columns,
  language,
}: DiffLineRowProps) {
  return (
    <Fragment>
      <CodeRow
        kind={line.kind}
        newNo={line.newNo}
        oldNo={line.oldNo}
        showNew={showNew}
        showOld={showOld}
        showSign
        sign={SIGN[line.kind]}
        signLabel={line.kind === "context" ? undefined : SIGN_LABEL[line.kind]}
        text={line.text}
      >
        <CodeText language={language} line={line} />
      </CodeRow>
      {line.noNewline ? (
        <CodeMetaRow columns={columns}>No newline at end of file</CodeMetaRow>
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
