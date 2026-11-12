"use client";

import type { ResolvedFile } from "@/lib/diff/resolve-file";

import { Fragment, useMemo, useState, type CSSProperties } from "react";

import { buildFileView, displayText, revealHiddenChars } from "./diff-model";
import { describeAnnotationTarget, DiffAnnotationNote } from "./DiffAnnotation";
import { DiffFoldToggle, DiffGap, DiffHunkHead } from "./DiffHunkRows";
import { DiffLineRow } from "./DiffLineRow";
import styles from "./Diff.module.css";

import { languageForPath } from "@/components/shared/code-highlight";

type DiffFileBodyProps = {
  file: ResolvedFile;
  /** Id of the region, so the file header can point at it. */
  id: string;
};

/** Text that was not a diff is shown, not guessed at. */
const PLAIN_TEXT_CHARS = 10_000;

/**
 * The open part of a file: a table of lines in a keyboard-scrollable region (long lines scroll
 * inside it, never the card), then any notices and comments that have no line to sit under.
 * Only mounted while the file is open, so a collapsed file costs one header.
 */
export function DiffFileBody({ file, id }: DiffFileBodyProps) {
  const view = useMemo(() => buildFileView(file), [file]);
  const language = useMemo(() => languageForPath(file.path), [file.path]);
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => new Set());
  const parsed = file.parsed;
  const hasRows = view.rows.length > 0;
  const columns = 2 + (view.showOld ? 1 : 0) + (view.showNew ? 1 : 0);

  function toggleFold(key: string) {
    setUnfolded((current) => {
      const next = new Set(current);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });
  }

  const plain = parsed && !parsed.recognized ? (parsed.plainText ?? "") : null;
  const plainShown =
    plain === null
      ? null
      : revealHiddenChars(
          plain.length > PLAIN_TEXT_CHARS ? `${plain.slice(0, PLAIN_TEXT_CHARS)}…` : plain
        ).text;

  return (
    <div id={id}>
      {parsed?.binary ? (
        <p className={styles.notice}>Binary file changed — there is no text diff to show.</p>
      ) : null}

      {parsed && parsed.recognized && !hasRows && !parsed.binary ? (
        <p className={styles.notice}>
          {file.status === "renamed"
            ? "Moved without line changes."
            : "No line changes in this diff."}
        </p>
      ) : null}

      {plainShown !== null ? (
        <>
          <p className={styles.notice}>
            This was not a unified diff, so it is shown as plain text.
          </p>
          {/* A scrollable region must be keyboard-focusable, or keyboard users cannot scroll it. */}
          <pre
            aria-label={`Text for ${displayText(file.path)}`}
            className={styles.plain}
            role="region"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            {plainShown}
          </pre>
        </>
      ) : null}

      {hasRows ? (
        <div
          aria-label={`Diff of ${displayText(file.path)}`}
          className={styles.scroll}
          role="region"
          style={{ "--diff-digits": view.digits } as CSSProperties}
          // A scrollable region must be keyboard-focusable, or keyboard users cannot scroll it.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <table className={styles.table}>
            <caption className={styles.srOnly}>Changed lines in {displayText(file.path)}</caption>
            <tbody>
              {view.rows.map((row) => {
                if (row.type === "hunk") {
                  return <DiffHunkHead key={row.key} columns={columns} row={row} />;
                }

                if (row.type === "gap") {
                  return <DiffGap key={row.key} columns={columns} row={row} />;
                }

                if (row.type === "fold") {
                  const open = unfolded.has(row.key);

                  return (
                    <Fragment key={row.key}>
                      <DiffFoldToggle
                        columns={columns}
                        count={row.lines.length}
                        expanded={open}
                        onToggle={() => toggleFold(row.key)}
                      />
                      {open
                        ? row.lines.map((line) => (
                            <DiffLineRow
                              key={line.id}
                              annotations={[]}
                              columns={columns}
                              language={language}
                              line={line}
                              showNew={view.showNew}
                              showOld={view.showOld}
                            />
                          ))
                        : null}
                    </Fragment>
                  );
                }

                return (
                  <DiffLineRow
                    key={row.key}
                    annotations={row.annotations}
                    columns={columns}
                    language={language}
                    line={row.line}
                    showNew={view.showNew}
                    showOld={view.showOld}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {view.hiddenLines > 0 ? (
        <p className={styles.notice}>
          {view.hiddenLines} more {view.hiddenLines === 1 ? "line is" : "lines are"} not shown here.
          Copy the diff to read all of it.
        </p>
      ) : null}

      {view.hasCutLines ? (
        <p className={styles.notice}>Some very long lines are shortened here.</p>
      ) : null}

      {view.hasHiddenChars ? (
        <p className={styles.notice}>
          This diff contains invisible or text-direction control characters. They are shown as ‹U+…›
          so they cannot hide changes.
        </p>
      ) : null}

      {view.unplaced.length > 0 ? (
        <>
          <p className={styles.unplacedLabel}>
            {hasRows ? "Comments not on a shown line" : "Comments"}
          </p>
          <ul className={styles.unplaced}>
            {view.unplaced.map(({ key, annotation }) => (
              <li key={key}>
                <DiffAnnotationNote
                  annotation={annotation}
                  where={describeAnnotationTarget(annotation)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
