/**
 * Tolerant unified-diff parser for ONE file's diff, as a model writes it or as `git diff` prints it.
 *
 * Never throws. Built for imperfect input: the `diff --git` / `index` / `---` / `+++` header is
 * optional, the whole text may sit in a markdown fence, `@@` counts may be wrong or absent, context
 * lines may have lost their leading space. Line numbers come from the hunk *start* values and the
 * line prefixes actually present — hunk counts are never trusted, because models routinely miscount
 * them. Text with no recognisable diff structure is reported as not `recognized` so the caller can
 * show it as plain text instead.
 */

export type DiffFileStatus = "added" | "modified" | "deleted" | "renamed";

export type DiffLineKind = "context" | "add" | "del";

export type DiffLine = {
  kind: DiffLineKind;
  /** The line without its one-character diff prefix. */
  text: string;
  /** Line number in the old file; null for added lines and for hunks without a start number. */
  oldNo: number | null;
  /** Line number in the new file; null for removed lines and for hunks without a start number. */
  newNo: number | null;
  /** A `\ No newline at end of file` marker followed this line. */
  noNewline?: boolean;
};

export type DiffHunk = {
  /** Null when the hunk header was missing, bare (`@@`) or unreadable. */
  oldStart: number | null;
  newStart: number | null;
  /** Counted from the lines actually present, never copied from the header. */
  oldCount: number;
  newCount: number;
  /** Text after the closing `@@` (git puts the enclosing function here). */
  section: string;
  lines: DiffLine[];
};

export type ParsedFileDiff = {
  /** Path from the diff headers (`a/` `b/` prefixes removed); null for `/dev/null` or none. */
  oldPath: string | null;
  newPath: string | null;
  /** Only set when the text itself proves it. Absent evidence stays null — never guessed. */
  status: Exclude<DiffFileStatus, "modified"> | null;
  binary: boolean;
  modeChange: { from: string; to: string } | null;
  /** `similarity index` percentage for renames, when present. */
  similarity: number | null;
  hunks: DiffHunk[];
  added: number;
  removed: number;
  /** Number of diff lines across all hunks. */
  lineCount: number;
  /**
   * True when the text had hunks, or a binary / rename / mode header. False means it was not a
   * diff at all and `plainText` holds what to show instead.
   */
  recognized: boolean;
  plainText: string | null;
};

/** The parser reads at most this much; schemas cap well below it. */
export const MAX_PARSE_CHARS = 200_000;

const HUNK_HEADER = /^@@+ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@+(.*)$/;
const DEV_NULL = "/dev/null";
const FENCE_ROW = /^(`{3,}|~{3,})\s*$/;
/** Git's marker is exactly `\ No newline at end of file`; a bare backslash could be real content. */
const NO_NEWLINE_MARKER = /^\\ /;

function emptyResult(plainText: string | null): ParsedFileDiff {
  return {
    oldPath: null,
    newPath: null,
    status: null,
    binary: false,
    modeChange: null,
    similarity: null,
    hunks: [],
    added: 0,
    removed: 0,
    lineCount: 0,
    recognized: false,
    plainText,
  };
}

/** Drops a surrounding markdown fence, and an opening fence whose closer never arrived. */
export function stripMarkdownFence(text: string): string {
  const rows = text.split("\n");
  let start = 0;
  let end = rows.length;

  while (start < end && rows[start]!.trim() === "") start += 1;
  while (end > start && rows[end - 1]!.trim() === "") end -= 1;

  if (start < end && /^(`{3,}|~{3,})[\w+.-]*\s*$/.test(rows[start]!.trim())) {
    start += 1;
    if (end > start && /^(`{3,}|~{3,})\s*$/.test(rows[end - 1]!.trim())) end -= 1;
  }

  return rows.slice(start, end).join("\n");
}

/** Line endings, BOM, fences, double-escaped newlines: everything that is not the diff itself. */
export function normalizeDiffText(input: string): string {
  let text = input.length > MAX_PARSE_CHARS ? input.slice(0, MAX_PARSE_CHARS) : input;

  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  // A model that double-escapes sends one line with literal "\n" in it.
  if (!text.includes("\n") && text.includes("\\n")) text = text.replace(/\\n/g, "\n");

  return stripMarkdownFence(text);
}

function cleanPath(raw: string): string | null {
  let path = raw.trim();

  // `--- a/file<TAB>2024-01-01 ...` — drop the timestamp git/diff -u may add.
  const tab = path.indexOf("\t");

  if (tab >= 0) path = path.slice(0, tab).trim();
  if (path.length >= 2 && path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
  if (path === DEV_NULL || path === "") return null;

  return path;
}

function stripSidePrefix(path: string | null, prefix: "a/" | "b/"): string | null {
  if (path && path.startsWith(prefix)) return path.slice(prefix.length);

  return path;
}

function parseCount(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);

  return Number.isFinite(n) ? n : 0;
}

export function parseUnifiedDiff(input: string): ParsedFileDiff {
  const original = typeof input === "string" ? input : "";
  const text = normalizeDiffText(original);

  if (text.trim() === "") return emptyResult(null);

  const rows = text.split("\n");
  const result = emptyResult(null);
  let current: DiffHunk | null = null;
  let oldNo: number | null = null;
  let newNo: number | null = null;
  let oldHeaderPath: string | null | undefined;
  let newHeaderPath: string | null | undefined;
  let sawNewFileMode = false;
  let sawDeletedFileMode = false;
  let renameFrom: string | null = null;
  let renameTo: string | null = null;
  let gitHeaderPaths: { from: string; to: string } | null = null;
  let oldMode: string | null = null;
  let newMode: string | null = null;

  function startHunk(oldStart: number | null, newStart: number | null, section: string): void {
    current = { oldStart, newStart, oldCount: 0, newCount: 0, section: section.trim(), lines: [] };
    result.hunks.push(current);
    oldNo = oldStart;
    newNo = newStart;
  }

  function pushLine(kind: DiffLineKind, lineText: string): void {
    const hunk = current;

    if (!hunk) return;

    const line: DiffLine = {
      kind,
      text: lineText,
      oldNo: kind === "add" ? null : oldNo,
      newNo: kind === "del" ? null : newNo,
    };

    if (kind !== "add") {
      hunk.oldCount += 1;
      if (oldNo !== null) oldNo += 1;
    }

    if (kind !== "del") {
      hunk.newCount += 1;
      if (newNo !== null) newNo += 1;
    }

    if (kind === "add") result.added += 1;
    if (kind === "del") result.removed += 1;
    result.lineCount += 1;
    hunk.lines.push(line);
  }

  function startsHunkAt(index: number): boolean {
    return rows[index]?.startsWith("@@") ?? false;
  }

  /** `--- x` + `+++ y` (+ a hunk when we are already inside one) is a header, not content. */
  function isFileHeaderAt(index: number, requireHunkAfter: boolean): boolean {
    const row = rows[index];
    const next = rows[index + 1];

    if (!row?.startsWith("--- ") || !next?.startsWith("+++ ")) return false;

    return requireHunkAfter ? startsHunkAt(index + 2) : true;
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const inHunk = current !== null;

    if (row.startsWith("diff --git ") || row.startsWith("diff --cc ")) {
      current = null;
      const m = /^diff --git "?a\/(.+?)"? "?b\/(.+?)"?$/.exec(row);

      if (m && !gitHeaderPaths) gitHeaderPaths = { from: m[1]!, to: m[2]! };
      continue;
    }

    if (startsHunkAt(i)) {
      const m = HUNK_HEADER.exec(row);

      if (m) {
        startHunk(parseCount(m[1]), parseCount(m[3]), m[5] ?? "");
      } else {
        startHunk(null, null, row.replace(/^@+\s*/, "").replace(/\s*@+\s*$/, ""));
      }
      continue;
    }

    if (isFileHeaderAt(i, inHunk)) {
      oldHeaderPath = cleanPath(row.slice(4));
      newHeaderPath = cleanPath(rows[i + 1]!.slice(4));
      current = null;
      i += 1;
      continue;
    }

    // Read through a function: hunks are opened inside closures, which TS flow analysis cannot see.
    const openHunk = (): DiffHunk | null => current;
    const hunkNow = openHunk();

    if (hunkNow) {
      // A bare fence cannot be a diff line (those start with a space, + or -): the diff ended.
      if (FENCE_ROW.test(row)) break;

      if (NO_NEWLINE_MARKER.test(row)) {
        const last = hunkNow.lines[hunkNow.lines.length - 1];

        if (last) last.noNewline = true;
        continue;
      }

      if (row.startsWith("+")) pushLine("add", row.slice(1));
      else if (row.startsWith("-")) pushLine("del", row.slice(1));
      else if (row.startsWith(" ")) pushLine("context", row.slice(1));
      // Context that lost its leading space (or an empty line git stripped): keep it as context.
      else pushLine("context", row);
      continue;
    }

    // Header section (before any hunk, or between files).
    let m: RegExpExecArray | null;

    if (row.startsWith("new file mode")) sawNewFileMode = true;
    else if (row.startsWith("deleted file mode")) sawDeletedFileMode = true;
    else if ((m = /^old mode (\S+)/.exec(row))) oldMode = m[1]!;
    else if ((m = /^new mode (\S+)/.exec(row))) newMode = m[1]!;
    else if ((m = /^rename from (.+)$/.exec(row))) renameFrom = cleanPath(m[1]!);
    else if ((m = /^rename to (.+)$/.exec(row))) renameTo = cleanPath(m[1]!);
    else if ((m = /^similarity index (\d+)%/.exec(row))) result.similarity = parseCount(m[1]);
    else if (/^Binary files .* differ$/.test(row) || row.startsWith("GIT binary patch")) {
      result.binary = true;
      const files = /^Binary files (.+) and (.+) differ$/.exec(row);

      if (files) {
        if (files[1] === DEV_NULL) sawNewFileMode = true;
        if (files[2] === DEV_NULL) sawDeletedFileMode = true;
      }
    } else if (row.startsWith("--- ")) {
      oldHeaderPath = cleanPath(row.slice(4));
    } else if (row.startsWith("+++ ")) {
      newHeaderPath = cleanPath(row.slice(4));
    } else if (row.startsWith("+") || row.startsWith("-")) {
      // A bare patch with no @@ line at all: one hunk of unknown position.
      startHunk(null, null, "");
      i -= 1;
    }
    // Anything else here (`index …`, `Index: …`, prose) is preamble and is ignored.
  }

  // Resolve paths: ---/+++ win, then rename lines, then the `diff --git` line.
  const fromHeader = stripSidePrefix(oldHeaderPath ?? null, "a/");
  const toHeader = stripSidePrefix(newHeaderPath ?? null, "b/");

  result.oldPath = fromHeader ?? renameFrom ?? gitHeaderPaths?.from ?? null;
  result.newPath = toHeader ?? renameTo ?? gitHeaderPaths?.to ?? null;

  if (oldHeaderPath === null) result.oldPath = null;
  if (newHeaderPath === null) result.newPath = null;

  if (oldMode && newMode && oldMode !== newMode) {
    result.modeChange = { from: oldMode, to: newMode };
  }

  const onlyAdds = result.hunks.length > 0 && result.removed === 0 && !hasContext(result.hunks);
  const onlyDels = result.hunks.length > 0 && result.added === 0 && !hasContext(result.hunks);
  const firstHunk = result.hunks[0];

  if (
    sawNewFileMode ||
    oldHeaderPath === null ||
    (onlyAdds && firstHunk?.oldStart === 0 && firstHunk.oldCount === 0)
  ) {
    // `oldHeaderPath === null` means a `--- /dev/null` header was present.
    result.status = "added";
  } else if (
    sawDeletedFileMode ||
    newHeaderPath === null ||
    (onlyDels && firstHunk?.newStart === 0 && firstHunk.newCount === 0)
  ) {
    result.status = "deleted";
  } else if (
    renameFrom !== null ||
    renameTo !== null ||
    (result.oldPath !== null && result.newPath !== null && result.oldPath !== result.newPath)
  ) {
    result.status = "renamed";
  }

  result.recognized =
    result.hunks.length > 0 ||
    result.binary ||
    result.status === "renamed" ||
    result.modeChange !== null ||
    sawNewFileMode ||
    sawDeletedFileMode;

  if (!result.recognized) {
    result.plainText = text;
    result.status = null;
  }

  return result;
}

/**
 * Cuts text that holds several files' diffs (a whole `git diff` pasted into one field) into one
 * string per file. A boundary is a `diff --git` line, or a `---` / `+++` / `@@` run once the
 * current file already has a hunk. Text that is not multi-file comes back as a single part.
 */
export function splitUnifiedDiff(input: string): string[] {
  const text = normalizeDiffText(typeof input === "string" ? input : "");

  if (text.trim() === "") return [];

  const rows = text.split("\n");
  const parts: string[][] = [[]];
  let sectionHasHunk = false;

  rows.forEach((row, index) => {
    const part = parts[parts.length - 1]!;
    const startsFile =
      row.startsWith("diff --git ") ||
      (sectionHasHunk &&
        row.startsWith("--- ") &&
        (rows[index + 1]?.startsWith("+++ ") ?? false) &&
        (rows[index + 2]?.startsWith("@@") ?? false));

    if (startsFile && part.some((r) => r.trim() !== "")) {
      parts.push([]);
      sectionHasHunk = false;
    }

    if (row.startsWith("@@")) sectionHasHunk = true;
    parts[parts.length - 1]!.push(row);
  });

  const joined = parts.map((part) => part.join("\n")).filter((part) => part.trim() !== "");

  return joined.length > 0 ? joined : [text];
}

function hasContext(hunks: readonly DiffHunk[]): boolean {
  return hunks.some((hunk) => hunk.lines.some((line) => line.kind === "context"));
}
