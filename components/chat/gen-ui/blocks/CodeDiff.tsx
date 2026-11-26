"use client";

import type { CodeDiffBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { displayText, pickInitiallyOpen } from "../diff/diff-model";
import { DIFF_STATUS, DiffStatusMark } from "../diff/diff-status";
import { DiffCounts, DiffStatBar } from "../diff/DiffCounts";
import { DiffFileBody } from "../diff/DiffFileBody";
import { DiffFileHeader } from "../diff/DiffFileHeader";
import { DiffFileIndex } from "../diff/DiffFileIndex";
import { DiffStatStrip } from "../diff/DiffStatStrip";
import styles from "../diff/Diff.module.css";

import { HighlightedText, languageForPath } from "@/components/shared/code-highlight";
import { useCodeWrap } from "@/components/shared/code/use-code-wrap";
import { fontMono } from "@/config/fonts";
import { resolveCodeDiffFiles, type ResolvedFile } from "@/lib/diff/resolve-file";
import { codeDiffTitle } from "@/lib/schemas/gen-ui/code-diff";
import { cn } from "@/lib/utils";

type CodeDiffProps = {
  block: CodeDiffBlock;
  partial?: boolean;
  /** GitHub-style diffstat: total strip, per-file rows with +N/−N and bars, a first-hunk excerpt. */
  condensed?: boolean;
};

/** Three or more files get an index; fewer read fine as the list of headers they already are. */
const INDEX_MIN_FILES = 3;

/** Condensed: file rows shown before the rest become "+N more", and excerpt length in lines. */
const CONDENSED_FILES = 5;
const EXCERPT_LINES = 4;

function hasBody(file: ResolvedFile): boolean {
  return file.diffText !== null || file.annotations.length > 0;
}

/** A path truncated in the middle: the directory gives way first, the file name stays whole. */
function CondensedPath({ path }: { path: string }) {
  const text = displayText(path);
  const slash = text.lastIndexOf("/");
  const dir = slash >= 0 ? text.slice(0, slash + 1) : "";
  const base = slash >= 0 ? text.slice(slash + 1) : text;

  return (
    <span className={cn(styles.mono, "flex min-w-0 flex-1 overflow-hidden text-xs")} title={text}>
      {dir ? <span className={cn(styles.pathDir, "min-w-0 truncate")}>{dir}</span> : null}
      <span className={cn(styles.pathBase, "min-w-0 shrink-0 truncate")}>{base}</span>
    </span>
  );
}

/** Up to a few lines around the first change of the first file that has hunks. */
function firstExcerpt(files: readonly ResolvedFile[]) {
  for (const file of files) {
    const hunk = file.parsed?.hunks[0];

    if (!hunk) continue;
    const firstChange = hunk.lines.findIndex((line) => line.kind !== "context");
    const start = Math.max(0, firstChange - 1);

    return {
      file,
      language: languageForPath(file.path),
      lines: hunk.lines.slice(start, start + EXCERPT_LINES),
    };
  }

  return null;
}

function CodeDiffCondensed({
  files,
  title,
  summary,
  moreFiles,
  totals,
  onGrow,
}: {
  files: readonly ResolvedFile[];
  title: string;
  summary: string | null;
  moreFiles?: number;
  totals: { added: number; removed: number } | null;
  /** Grow into the full diff in place; absent when there are no changed lines to show. */
  onGrow?: () => void;
}) {
  const visible = files.slice(0, CONDENSED_FILES);
  const more = files.length - visible.length + (moreFiles ?? 0);
  const excerpt = firstExcerpt(files);
  const fileCount = files.length + (moreFiles ?? 0);

  return (
    // .root is a grid with its own stack gap, so no space-y here.
    <div className={cn(styles.root, "organic-code mx-auto w-full max-w-sm", fontMono.variable)}>
      <header className="space-y-stack-xs">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        {summary ? <p className="line-clamp-2 text-xs text-muted-foreground">{summary}</p> : null}
        <div className={styles.strip}>
          <span>
            {fileCount} {fileCount === 1 ? "file" : "files"} changed
          </span>
          {totals ? (
            <>
              <DiffCounts added={totals.added} removed={totals.removed} />
              <DiffStatBar added={totals.added} removed={totals.removed} />
            </>
          ) : null}
        </div>
      </header>

      <ul aria-label="Files changed" className="space-y-stack-xs">
        {visible.map((file) => (
          <li key={file.key} className="flex min-w-0 items-center gap-inline-sm">
            <DiffStatusMark status={file.status} />
            <span className="sr-only">{DIFF_STATUS[file.status].word}:</span>
            <CondensedPath path={file.path} />
            {file.countsKnown ? (
              <span className="flex shrink-0 items-center gap-inline-sm text-xs tabular-nums">
                <DiffCounts added={file.added} removed={file.removed} />
                <DiffStatBar added={file.added} removed={file.removed} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          +{more} more {more === 1 ? "file" : "files"}
        </p>
      ) : null}

      {excerpt && excerpt.lines.length > 0 ? (
        <figure
          aria-label={`First change in ${displayText(excerpt.file.path)}`}
          className="overflow-hidden rounded-lg bg-muted/40"
        >
          {excerpt.lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                styles.mono,
                "flex gap-inline-sm px-inset-sm text-2xs",
                line.kind === "add" && "bg-accent/10",
                line.kind === "del" && "bg-destructive/10"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "shrink-0",
                  line.kind === "add" && styles.countAdd,
                  line.kind === "del" && styles.countDel,
                  line.kind === "context" && "text-muted-foreground"
                )}
              >
                {line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}
              </span>
              <span className="sr-only">
                {line.kind === "add" ? "Added: " : line.kind === "del" ? "Removed: " : ""}
              </span>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre">
                <HighlightedText language={excerpt.language} text={displayText(line.text)} />
              </span>
            </div>
          ))}
        </figure>
      ) : null}

      {onGrow ? <GrowToggle expanded={false} label="Show all changes" onToggle={onGrow} /> : null}
    </div>
  );
}

/**
 * A change to code, read from standard unified-diff text. The block parses it, counts lines,
 * works out added / deleted / renamed, folds long unchanged runs and pairs lines for in-line
 * emphasis — the model supplies none of that. Opening and wrapping are local view state only.
 */
export function CodeDiff({ block, partial, condensed = false }: CodeDiffProps) {
  const files = useMemo(() => resolveCodeDiffFiles(block.files), [block.files]);
  const defaults = useMemo(
    () => pickInitiallyOpen(files.map((file) => file.parsed?.lineCount ?? 0)),
    [files]
  );
  const baseId = useId();
  // Until the reader chooses, a file's openness follows the data (a streaming or updated diff).
  const [chosen, setChosen] = useState<Readonly<Record<string, boolean>>>({});
  const { wrapped, surface, toggle: toggleWrap } = useCodeWrap();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const toggles = useRef(new Map<string, HTMLElement | null>());
  /** Condensed only: the reader grew the summary into the full diff in place. */
  const [grown, setGrown] = useState(false);

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

  if (condensed && !grown) {
    return (
      <CodeDiffCondensed
        files={files}
        moreFiles={block.moreFiles}
        summary={summary}
        title={displayText(codeDiffTitle(block))}
        totals={totals}
        onGrow={bodied.length > 0 ? () => setGrown(true) : undefined}
      />
    );
  }

  return (
    <div
      className={cn(styles.root, "organic-code", fontMono.variable)}
      data-partial={partial ? "true" : undefined}
      data-wrap={wrapped ? "true" : undefined}
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
        wrap={wrapped}
        onToggleAll={
          bodied.length >= 2
            ? () =>
                setChosen(
                  Object.fromEntries(files.filter(hasBody).map((file) => [file.key, !allOpen]))
                )
            : undefined
        }
        onToggleWrap={toggleWrap}
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
              {open && hasBody(file) ? <DiffFileBody file={file} id={bodyId} {...surface} /> : null}
            </section>
          );
        })}
      </div>

      {condensed ? (
        <GrowToggle expanded label="Show less" onToggle={() => setGrown(false)} />
      ) : null}
    </div>
  );
}

/**
 * The condensed diff grows into the full one in place, and back, from the same block: no second
 * copy of the diff mounted beneath it.
 */
function GrowToggle({
  expanded,
  label,
  onToggle,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="organic-focus flex min-h-11 w-full items-center justify-between gap-inline-sm border-t border-border/50 text-xs text-muted-foreground focus-visible:text-foreground focus-visible:outline-none"
    >
      {label}
    </button>
  );
}
