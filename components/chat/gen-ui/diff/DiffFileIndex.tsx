import type { ResolvedFile } from "@/lib/diff/resolve-file";

import { DiffCounts } from "./DiffCounts";
import { DiffPath } from "./DiffFileHeader";
import { DiffStatusMark, DiffStatusWord } from "./diff-status";
import styles from "./Diff.module.css";

type DiffFileIndexProps = {
  files: readonly ResolvedFile[];
  /** Which files have something to open. */
  hasBody: (file: ResolvedFile) => boolean;
  /** Open a file and move focus to its header. */
  onJump: (file: ResolvedFile) => void;
};

function Entry({ file, openable }: { file: ResolvedFile; openable: boolean }) {
  return (
    <>
      <DiffStatusMark status={file.status} />
      <DiffPath path={file.path} />
      <DiffStatusWord status={file.status} />
      {file.countsKnown ? <DiffCounts added={file.added} removed={file.removed} /> : null}
      {openable ? <span className={styles.srOnly}>Open this file</span> : null}
    </>
  );
}

/** A table of contents for three or more files; entries with a body are buttons. */
export function DiffFileIndex({ files, hasBody, onJump }: DiffFileIndexProps) {
  return (
    <nav aria-label="Files changed">
      <ul className={styles.index}>
        {files.map((file) => (
          <li key={file.key}>
            {hasBody(file) ? (
              <button className={styles.indexItem} type="button" onClick={() => onJump(file)}>
                <Entry file={file} openable />
              </button>
            ) : (
              <div className={styles.indexItem}>
                <Entry file={file} openable={false} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
