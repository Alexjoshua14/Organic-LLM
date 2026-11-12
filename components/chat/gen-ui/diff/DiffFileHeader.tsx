import type { ResolvedFile } from "@/lib/diff/resolve-file";

import { displayText } from "./diff-model";
import { DiffCopyButton } from "./DiffCopyButton";
import { DiffCounts } from "./DiffCounts";
import { DiffStatusMark, DiffStatusWord } from "./diff-status";
import styles from "./Diff.module.css";

/** A path with its directory dimmed and its file name strong. Text only, never a link. */
export function DiffPath({ path }: { path: string }) {
  const text = displayText(path);
  const slash = text.lastIndexOf("/");
  const dir = slash >= 0 ? text.slice(0, slash + 1) : "";
  const base = slash >= 0 ? text.slice(slash + 1) : text;

  return (
    <span className={`${styles.path} ${styles.mono}`}>
      {dir ? <span className={styles.pathDir}>{dir}</span> : null}
      <span className={styles.pathBase}>{base}</span>
    </span>
  );
}

function Chevron() {
  return (
    <svg aria-hidden className={styles.chevron} focusable="false" viewBox="0 0 12 12">
      <path
        d="M4.5 2.5 8 6 4.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

type DiffFileHeaderProps = {
  file: ResolvedFile;
  /** True when opening the file reveals something (a diff, or comments). */
  hasBody: boolean;
  open: boolean;
  bodyId: string;
  onToggle: () => void;
  /** Lets the file index move focus to this header. */
  registerToggle?: (element: HTMLElement | null) => void;
};

function toggleContent(file: ResolvedFile, hasBody: boolean) {
  return (
    <>
      {hasBody ? <Chevron /> : null}
      <DiffStatusMark status={file.status} />
      <DiffPath path={file.path} />
      <DiffStatusWord status={file.status} />
      {file.countsKnown ? <DiffCounts added={file.added} removed={file.removed} /> : null}
    </>
  );
}

/**
 * Header for one file: the toggle (status mark and word, path, counts), a copy button, then the
 * facts that stay visible when the file is closed — where it moved from, mode change, the note.
 * A file with nothing to open is a plain row, not a control.
 */
export function DiffFileHeader({
  file,
  hasBody,
  open,
  bodyId,
  onToggle,
  registerToggle,
}: DiffFileHeaderProps) {
  const parsed = file.parsed;

  return (
    <>
      <div className={styles.fileHead}>
        <h4 className={styles.fileTitle}>
          {hasBody ? (
            <button
              ref={registerToggle}
              aria-controls={open ? bodyId : undefined}
              aria-expanded={open}
              className={styles.toggle}
              type="button"
              onClick={onToggle}
            >
              {toggleContent(file, true)}
            </button>
          ) : (
            <span className={styles.toggle}>{toggleContent(file, false)}</span>
          )}
        </h4>
        {file.diffText ? (
          <DiffCopyButton path={displayText(file.path)} text={file.diffText} />
        ) : null}
      </div>

      <div className={styles.fileMeta}>
        {file.oldPath ? (
          <p>
            Moved from <span className={styles.mono}>{displayText(file.oldPath)}</span>
            {parsed?.similarity !== null && parsed?.similarity !== undefined
              ? ` (${parsed.similarity}% similar)`
              : ""}
          </p>
        ) : null}
        {parsed?.modeChange ? (
          <p>
            File mode changed from{" "}
            <span className={styles.mono}>{displayText(parsed.modeChange.from)}</span> to{" "}
            <span className={styles.mono}>{displayText(parsed.modeChange.to)}</span>
          </p>
        ) : null}
        {file.note ? <p className={styles.fileNote}>{displayText(file.note)}</p> : null}
        {file.diffText === null ? <p>No diff is shown for this file.</p> : null}
      </div>
    </>
  );
}
