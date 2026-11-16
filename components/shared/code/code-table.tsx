import type { CSSProperties, ReactNode } from "react";

import styles from "./code.module.css";

/** Class for a changed span inside a line (pass it to `HighlightedText`). */
export const CODE_EMPHASIS_CLASS = styles.emph;

type CodeTableProps = {
  /** Screen-reader caption, e.g. "Changed lines in lib/x.ts". */
  caption?: string;
  children: ReactNode;
};

/**
 * The line table. Rows are `CodeRow`s; a view with its own kinds of row (hunk heads, folds,
 * comments) renders them inside the same body, spanning the columns.
 */
export function CodeTable({ caption, children }: CodeTableProps) {
  return (
    <table className={styles.table}>
      {caption ? <caption className={styles.srOnly}>{caption}</caption> : null}
      <tbody>{children}</tbody>
    </table>
  );
}

export type CodeRowKind = "add" | "del" | "context";

export type CodeRowProps = {
  kind?: CodeRowKind;
  /** Gutter columns present in the table: old, new, or both (diff). */
  showOld?: boolean;
  showNew?: boolean;
  oldNo?: number | null;
  newNo?: number | null;
  /** The +/− column (diff). Its cell is named for assistive tech when `signLabel` is given. */
  showSign?: boolean;
  sign?: string;
  signLabel?: string;
  /** The line's source text, used to draw the indentation guides. */
  text: string;
  /** The code cell's content: plain text or syntax tokens. Never markup. */
  children?: ReactNode;
};

/**
 * One line of code: optional gutters and sign, then the code in a `<code>` whose guides follow the
 * line's indentation. Text only; callers never pass markup.
 */
export function CodeRow({
  kind,
  showOld = false,
  showNew = false,
  oldNo,
  newNo,
  showSign = false,
  sign,
  signLabel,
  text,
  children,
}: CodeRowProps) {
  const indent = {
    "--indent-columns": text.match(/^ */)?.[0].length ?? 0,
  } as CSSProperties;

  return (
    <tr className={styles.line} data-kind={kind} style={indent}>
      {showOld ? <td className={styles.num}>{oldNo ?? ""}</td> : null}
      {showNew ? <td className={styles.num}>{newNo ?? ""}</td> : null}
      {showSign ? (
        <td aria-label={signLabel} className={styles.sign}>
          {sign}
        </td>
      ) : null}
      <td className={styles.codeCell}>
        <code>
          {children === undefined || children === null || children === "" ? "​" : children}
        </code>
      </td>
    </tr>
  );
}

/** A full-width row of notes inside the table (e.g. "No newline at end of file"). */
export function CodeMetaRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <tr className={styles.line} data-kind="meta">
      <td className={styles.sign} colSpan={columns - 1} />
      <td className={styles.codeCell}>
        <code>{children}</code>
      </td>
    </tr>
  );
}

/** A block too large to tokenize or lay out line by line: one text node, no gutter, no tokens. */
export function CodePlain({ children }: { children: ReactNode }) {
  return <pre className={styles.plain}>{children}</pre>;
}
