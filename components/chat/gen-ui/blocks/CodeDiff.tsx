"use client";

import type { CodeDiffBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { displayText, pickInitiallyOpen } from "../diff/diff-model";
import { DiffFileBody } from "../diff/DiffFileBody";
import { DiffFileHeader } from "../diff/DiffFileHeader";
import { DiffFileIndex } from "../diff/DiffFileIndex";
import { DiffStatStrip } from "../diff/DiffStatStrip";
import styles from "../diff/Diff.module.css";

import { fontMono } from "@/config/fonts";
import { resolveCodeDiffFiles, type ResolvedFile } from "@/lib/diff/resolve-file";
import { cn } from "@/lib/utils";

type CodeDiffProps = {
  block: CodeDiffBlock;
  partial?: boolean;
};

/** Three or more files get an index; fewer read fine as the list of headers they already are. */
const INDEX_MIN_FILES = 3;

function hasBody(file: ResolvedFile): boolean {
  return file.diffText !== null || file.annotations.length > 0;
}

/**
 * A change to code, read from standard unified-diff text. The block parses it, counts lines,
 * works out added / deleted / renamed, folds long unchanged runs and pairs lines for in-line
 * emphasis — the model supplies none of that. Opening and wrapping are local view state only.
 */
export function CodeDiff({ block, partial }: CodeDiffProps) {
  const files = useMemo(() => resolveCodeDiffFiles(block.files), [block.files]);
  const defaults = useMemo(
    () => pickInitiallyOpen(files.map((file) => file.parsed?.lineCount ?? 0)),
    [files]
  );
  const baseId = useId();
  // Until the reader chooses, a file's openness follows the data (a streaming or updated diff).
  const [chosen, setChosen] = useState<Readonly<Record<string, boolean>>>({});
  const [wrap, setWrap] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const toggles = useRef(new Map<string, HTMLElement | null>());

  const isOpen = useCallback(
    (file: ResolvedFile, index: number) => chosen[file.key] ?? defaults[index] ?? false,
    [chosen, defaults]
  );

  useEffect(() => {
    if (focusKey === null) return;
    toggles.current.get(focusKey)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const bodied = files.filter(hasBody);
  const allOpen = bodied.length > 0 && files.every((file, i) => !hasBody(file) || isOpen(file, i));
  const known = files.filter((file) => file.countsKnown);
  const totals =
    known.length > 0
      ? {
          added: known.reduce((sum, file) => sum + file.added, 0),
          removed: known.reduce((sum, file) => sum + file.removed, 0),
        }
      : null;
  const title = block.title ? displayText(block.title) : null;
  const summary = block.summary ? displayText(block.summary) : null;

  return (
    <div
      className={cn(styles.root, "organic-code", fontMono.variable)}
      data-partial={partial ? "true" : undefined}
      data-wrap={wrap ? "true" : undefined}
    >
      {title || summary ? (
        <header className={styles.header}>
          {title ? <h3 className={styles.title}>{title}</h3> : null}
          {summary ? <p className={styles.summary}>{summary}</p> : null}
        </header>
      ) : null}

      <DiffStatStrip
        allOpen={allOpen}
        fileCount={files.length}
        moreFiles={block.moreFiles}
        totals={totals}
        wrap={wrap}
        onToggleAll={
          bodied.length >= 2
            ? () =>
                setChosen(
                  Object.fromEntries(files.filter(hasBody).map((file) => [file.key, !allOpen]))
                )
            : undefined
        }
        onToggleWrap={() => setWrap((value) => !value)}
      />

      {files.length >= INDEX_MIN_FILES ? (
        <DiffFileIndex
          files={files}
          hasBody={hasBody}
          onJump={(file) => {
            setChosen((current) => ({ ...current, [file.key]: true }));
            setFocusKey(file.key);
          }}
        />
      ) : null}

      <div className={styles.files}>
        {files.map((file, index) => {
          const open = isOpen(file, index);
          const bodyId = `${baseId}-${file.key}`;

          return (
            <section key={file.key} className={styles.file}>
              <DiffFileHeader
                bodyId={bodyId}
                file={file}
                hasBody={hasBody(file)}
                open={open}
                registerToggle={(element) => {
                  if (element) toggles.current.set(file.key, element);
                  else toggles.current.delete(file.key);
                }}
                onToggle={() => setChosen((current) => ({ ...current, [file.key]: !open }))}
              />
              {open && hasBody(file) ? <DiffFileBody file={file} id={bodyId} /> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
