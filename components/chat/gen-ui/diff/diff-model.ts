import type { DiffHunk, DiffLineKind } from "@/lib/diff/parse-unified";
import type { ResolvableAnnotation, ResolvedFile } from "@/lib/diff/resolve-file";

/**
 * Everything the diff UI states is derived here from the parsed diff, and only from it: counts are
 * counts of lines present, line numbers come from hunk starts plus the prefixes actually seen, and
 * nothing is inferred about the code itself. Model-supplied text is only ever shortened or made
 * visible here — never interpreted as markup.
 */

/** Unchanged lines kept on each side of a change; longer runs fold. */
export const FOLD_KEEP = 3;
/** A fold must hide at least this many lines, or it costs more space than it saves. */
export const FOLD_MIN_HIDDEN = 3;
/** Rows shown per file; the rest are counted, not rendered. */
export const MAX_FILE_LINES = 600;
/** Characters shown per line; the full text stays in the copied diff. */
export const MAX_LINE_CHARS = 2_000;
/** A file opens by default if it fits this many lines alongside the files already open. */
export const OPEN_LINE_BUDGET = 160;
/** The first file opens by default up to this size even when it exceeds the budget. */
export const OPEN_FIRST_FILE_MAX = 400;

export type Range = readonly [start: number, end: number];

export type DisplayLine = {
  id: string;
  kind: DiffLineKind;
  /** Shown text: hidden characters made visible, over-long lines shortened. */
  text: string;
  oldNo: number | null;
  newNo: number | null;
  noNewline: boolean;
  /** Characters that differ from the paired line, when one was found. */
  emphasis: Range | null;
  /** The shown text is shorter than the line. */
  cut: boolean;
};

export type PlacedAnnotation = { key: string; annotation: ResolvableAnnotation };

export type DiffRow =
  | { type: "hunk"; key: string; label: string; section: string }
  | { type: "line"; key: string; line: DisplayLine; annotations: PlacedAnnotation[] }
  | { type: "fold"; key: string; lines: DisplayLine[] }
  | { type: "gap"; key: string; count: number; where: "before" | "between" };

export type FileView = {
  rows: DiffRow[];
  /** Comments that could not be tied to a shown line, still shown under the file. */
  unplaced: PlacedAnnotation[];
  /** Lines in the diff that are not rendered (over the per-file cap). */
  hiddenLines: number;
  /** Characters wide the line-number columns need. */
  digits: number;
  /** Which number columns carry anything (an added file has no old numbers, and so on). */
  showOld: boolean;
  showNew: boolean;
  /** Zero-width or direction-control characters were found and made visible. */
  hasHiddenChars: boolean;
  /** Lines were shortened for display. */
  hasCutLines: boolean;
};

// ── Hidden characters ─────────────────────────────────────

// Control characters other than tab, zero-width characters, and the bidirectional overrides and
// isolates (the "Trojan Source" set). A diff reader is exactly where these must be visible.
const HIDDEN_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function revealHiddenChars(text: string): { text: string; found: boolean } {
  let found = false;
  const revealed = text.replace(HIDDEN_CHARS, (char) => {
    found = true;

    return `‹U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}›`;
  });

  return { text: revealed, found };
}

/** A model-supplied path or label as one visible line of text. */
export function displayText(value: string): string {
  return revealHiddenChars(value.replace(/[\r\n\t]+/g, " ")).text;
}

// ── Intra-line emphasis ───────────────────────────────────

const TOKEN = /\s+|[A-Za-z0-9_$]+|[^\sA-Za-z0-9_$]/g;
const MAX_EMPHASIS_CHARS = 500;
const MIN_SHARED_RATIO = 0.4;

/**
 * The changed middle of a removed line and the line that replaced it: everything after their
 * common leading tokens and before their common trailing tokens. Null when the lines share too
 * little for the highlight to mean anything (then the whole line is the change).
 */
export function computeEmphasis(
  removed: string,
  added: string
): { removed: Range | null; added: Range | null } | null {
  if (removed === added) return null;
  if (removed.length > MAX_EMPHASIS_CHARS || added.length > MAX_EMPHASIS_CHARS) return null;

  const a = removed.match(TOKEN) ?? [];
  const b = added.match(TOKEN) ?? [];
  let prefix = 0;

  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;

  let suffix = 0;

  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const prefixChars = a.slice(0, prefix).join("").length;
  const suffixChars = a.slice(a.length - suffix).join("").length;
  const longest = Math.max(removed.length, added.length);

  if (longest === 0 || (prefixChars + suffixChars) / longest < MIN_SHARED_RATIO) return null;

  const removedRange: Range = [prefixChars, removed.length - suffixChars];
  const addedRange: Range = [prefixChars, added.length - suffixChars];

  return {
    removed: removedRange[1] > removedRange[0] ? removedRange : null,
    added: addedRange[1] > addedRange[0] ? addedRange : null,
  };
}

/** Splits a line's text around its emphasised range: [before, changed, after]. */
export function splitAtRange(text: string, range: Range | null): [string, string, string] {
  if (!range) return [text, "", ""];

  const start = Math.max(0, Math.min(range[0], text.length));
  const end = Math.max(start, Math.min(range[1], text.length));

  return [text.slice(0, start), text.slice(start, end), text.slice(end)];
}

// ── Stat bar and default-open policy ──────────────────────

export type StatBlock = "add" | "del" | "none";

/** Five blocks, proportioned by added vs removed; decorative (the counts are text). */
export function statBlocks(added: number, removed: number): StatBlock[] {
  const total = added + removed;

  if (total <= 0) return Array.from({ length: 5 }, () => "none" as const);

  let add = Math.round((5 * added) / total);

  if (added > 0 && add === 0) add = 1;
  if (removed > 0 && add === 5) add = 4;

  return [
    ...Array.from({ length: add }, () => "add" as const),
    ...Array.from({ length: 5 - add }, () => "del" as const),
  ];
}

/**
 * Which files start open. A single file always does. Otherwise files open in order while they fit
 * the budget; the first opens even when it overshoots, up to a size that is still readable.
 */
export function pickInitiallyOpen(lineCounts: readonly number[]): boolean[] {
  if (lineCounts.length === 1) return [true];

  let used = 0;

  return lineCounts.map((count, index) => {
    const fits =
      count === 0 ||
      (index === 0 ? count <= OPEN_FIRST_FILE_MAX : used + count <= OPEN_LINE_BUDGET);

    if (fits) used += count;

    return fits;
  });
}

// ── Annotations ───────────────────────────────────────────

type Entry = { id: string; line: DisplayLine };

function lineNumberFor(line: DisplayLine, side: "new" | "old" | undefined): number | null {
  if (side === "old") return line.oldNo;
  if (side === "new") return line.newNo;

  return line.newNo ?? line.oldNo;
}

function eligible(line: DisplayLine, side: "new" | "old" | undefined): boolean {
  if (side === "old") return line.kind !== "add";
  if (side === "new") return line.kind !== "del";

  return true;
}

function squash(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Where a comment goes. `match` (text on the line) is more reliable than `line` because models
 * miscount; with both, the matching line nearest the stated number wins. Null means "no shown
 * line fits", and the comment is listed under the file instead of being dropped.
 */
export function resolveAnnotationTarget(
  annotation: ResolvableAnnotation,
  entries: readonly Entry[]
): string | null {
  const { line, side } = annotation;
  const needle = annotation.match?.trim();
  const pool = entries.filter((entry) => eligible(entry.line, side));

  if (needle) {
    let hits = pool.filter((entry) => entry.line.text.includes(needle));

    if (hits.length === 0) {
      const loose = squash(needle);

      hits = loose ? pool.filter((entry) => squash(entry.line.text).includes(loose)) : [];
    }

    if (hits.length > 0) {
      if (line !== undefined) {
        const distance = (entry: Entry) => {
          const n = lineNumberFor(entry.line, side);

          return n === null ? Number.POSITIVE_INFINITY : Math.abs(n - line);
        };

        return [...hits].sort((x, y) => distance(x) - distance(y))[0]!.id;
      }

      // Without a number prefer a changed line: that is what a comment is nearly always about.
      return (hits.find((entry) => entry.line.kind !== "context") ?? hits[0]!).id;
    }
  }

  if (line !== undefined) {
    // With no side given, prefer the new file, then fall back to a removed line.
    // `pool` already leaves out lines that are not on the requested side.
    const exact =
      side === undefined
        ? (pool.find((entry) => entry.line.kind !== "del" && entry.line.newNo === line) ??
          pool.find((entry) => entry.line.kind === "del" && entry.line.oldNo === line))
        : pool.find((entry) => lineNumberFor(entry.line, side) === line);

    if (exact) return exact.id;
  }

  return null;
}

// ── Row building ──────────────────────────────────────────

export function hunkLabel(
  hunk: Pick<DiffHunk, "oldStart" | "newStart" | "oldCount" | "newCount">
): string {
  if (hunk.oldStart === null || hunk.newStart === null) return "@@";

  return `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
}

function toDisplayLines(hunk: DiffHunk, hunkIndex: number, budget: { left: number }) {
  const lines: DisplayLine[] = [];
  let hidden = 0;
  let hasHiddenChars = false;
  let hasCutLines = false;

  hunk.lines.forEach((line, lineIndex) => {
    if (budget.left <= 0) {
      hidden += 1;

      return;
    }

    budget.left -= 1;

    const revealed = revealHiddenChars(line.text);
    const cut = revealed.text.length > MAX_LINE_CHARS;

    if (revealed.found) hasHiddenChars = true;
    if (cut) hasCutLines = true;

    lines.push({
      id: `${hunkIndex}.${lineIndex}`,
      kind: line.kind,
      text: cut ? `${revealed.text.slice(0, MAX_LINE_CHARS)}…` : revealed.text,
      oldNo: line.oldNo,
      newNo: line.newNo,
      noNewline: line.noNewline === true,
      emphasis: null,
      cut,
    });
  });

  return { lines, hidden, hasHiddenChars, hasCutLines };
}

/** Pairs each run of removed lines with the run of added lines that directly follows it. */
function applyEmphasis(lines: DisplayLine[]): void {
  let i = 0;

  while (i < lines.length) {
    if (lines[i]!.kind !== "del") {
      i += 1;
      continue;
    }

    let j = i;

    while (j < lines.length && lines[j]!.kind === "del") j += 1;

    let k = j;

    while (k < lines.length && lines[k]!.kind === "add") k += 1;

    const pairs = Math.min(j - i, k - j);

    for (let p = 0; p < pairs; p += 1) {
      const removed = lines[i + p]!;
      const added = lines[j + p]!;
      const emphasis = computeEmphasis(removed.text, added.text);

      if (emphasis) {
        removed.emphasis = emphasis.removed;
        added.emphasis = emphasis.added;
      }
    }

    i = Math.max(k, i + 1);
  }
}

function foldContext(
  lines: DisplayLine[],
  hunkIndex: number,
  anchored: ReadonlySet<string>,
  annotationsFor: (id: string) => PlacedAnnotation[]
): DiffRow[] {
  const rows: DiffRow[] = [];
  const isChange = (line: DisplayLine) => line.kind !== "context" || anchored.has(line.id);
  const hasChange = lines.some(isChange);
  const pushLine = (line: DisplayLine) =>
    rows.push({ type: "line", key: line.id, line, annotations: annotationsFor(line.id) });
  let i = 0;

  while (i < lines.length) {
    if (isChange(lines[i]!)) {
      pushLine(lines[i]!);
      i += 1;
      continue;
    }

    let j = i;

    while (j < lines.length && !isChange(lines[j]!)) j += 1;

    const run = lines.slice(i, j);
    const keepHead = i === 0 ? 0 : FOLD_KEEP;
    const keepTail = j === lines.length ? 0 : FOLD_KEEP;
    const hiddenCount = run.length - keepHead - keepTail;

    if (hasChange && hiddenCount >= FOLD_MIN_HIDDEN) {
      run.slice(0, keepHead).forEach(pushLine);
      rows.push({
        type: "fold",
        key: `fold-${hunkIndex}-${i}`,
        lines: run.slice(keepHead, run.length - keepTail),
      });
      run.slice(run.length - keepTail).forEach(pushLine);
    } else {
      run.forEach(pushLine);
    }

    i = j;
  }

  return rows;
}

export function buildFileView(
  file: Pick<ResolvedFile, "parsed" | "annotations">,
  options: { maxLines?: number } = {}
): FileView {
  const parsed = file.parsed;
  const empty: FileView = {
    rows: [],
    unplaced: file.annotations.map((annotation, i) => ({ key: `u${i}`, annotation })),
    hiddenLines: 0,
    digits: 1,
    showOld: false,
    showNew: false,
    hasHiddenChars: false,
    hasCutLines: false,
  };

  if (!parsed || !parsed.recognized || parsed.hunks.length === 0) return empty;

  const budget = { left: options.maxLines ?? MAX_FILE_LINES };
  let hiddenLines = 0;
  let hasHiddenChars = false;
  let hasCutLines = false;

  const shown = parsed.hunks
    .map((hunk, hunkIndex) => {
      const built = toDisplayLines(hunk, hunkIndex, budget);

      hiddenLines += built.hidden;
      hasHiddenChars ||= built.hasHiddenChars;
      hasCutLines ||= built.hasCutLines;
      applyEmphasis(built.lines);

      return { hunk, hunkIndex, lines: built.lines };
    })
    .filter((entry) => entry.lines.length > 0);

  const entries: Entry[] = shown.flatMap((entry) =>
    entry.lines.map((line) => ({ id: line.id, line }))
  );
  const placed = new Map<string, PlacedAnnotation[]>();
  const unplaced: PlacedAnnotation[] = [];

  file.annotations.forEach((annotation, index) => {
    const target = resolveAnnotationTarget(annotation, entries);
    const item: PlacedAnnotation = { key: `a${index}`, annotation };

    if (target === null) {
      unplaced.push(item);

      return;
    }

    placed.set(target, [...(placed.get(target) ?? []), item]);
  });

  const anchored = new Set(placed.keys());
  const annotationsFor = (id: string) => placed.get(id) ?? [];
  const rows: DiffRow[] = [];
  let digits = 1;
  let showOld = false;
  let showNew = false;

  shown.forEach((entry, position) => {
    const { hunk, hunkIndex, lines } = entry;
    const previous = shown[position - 1]?.hunk;

    // Lines between hunks that the diff does not show (known only when starts are numbered).
    if (previous && previous.oldStart !== null && hunk.oldStart !== null) {
      const count = hunk.oldStart - (previous.oldStart + previous.oldCount);

      if (previous.oldStart > 0 && count > 0) {
        rows.push({ type: "gap", key: `gap-${hunkIndex}`, count, where: "between" });
      }
    } else if (!previous && hunk.oldStart !== null && hunk.oldStart > 1) {
      rows.push({
        type: "gap",
        key: `gap-${hunkIndex}`,
        count: hunk.oldStart - 1,
        where: "before",
      });
    }

    rows.push({
      type: "hunk",
      key: `hunk-${hunkIndex}`,
      label: hunkLabel(hunk),
      section: displayText(hunk.section),
    });
    rows.push(...foldContext(lines, hunkIndex, anchored, annotationsFor));

    for (const line of lines) {
      digits = Math.max(digits, String(line.oldNo ?? 0).length, String(line.newNo ?? 0).length);
      if (line.oldNo !== null) showOld = true;
      if (line.newNo !== null) showNew = true;
    }
  });

  return { rows, unplaced, hiddenLines, digits, showOld, showNew, hasHiddenChars, hasCutLines };
}
