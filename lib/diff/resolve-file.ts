import {
  parseUnifiedDiff,
  splitUnifiedDiff,
  type DiffFileStatus,
  type ParsedFileDiff,
} from "./parse-unified";

/**
 * Turns the model's per-file entries into what the UI and the markdown export both need: the
 * parsed diff, an app-derived status, and line counts the app computed. A diff the model pasted
 * for several files in one entry is split into one resolved file per diff.
 */

export type ResolvableAnnotation = {
  line?: number;
  side?: "new" | "old";
  match?: string;
  kind?: "note" | "issue" | "suggestion";
  text: string;
};

export type ResolvableFile = {
  path: string;
  oldPath?: string;
  status?: DiffFileStatus;
  diff?: string;
  added?: number;
  removed?: number;
  note?: string;
  annotations?: ResolvableAnnotation[];
};

export type ResolvedFile = {
  /** Position-based, unique even when two files share a path. */
  key: string;
  path: string;
  oldPath: string | null;
  status: DiffFileStatus;
  note: string | null;
  /** The (normalised) diff text for this one file; null when none was supplied. */
  diffText: string | null;
  parsed: ParsedFileDiff | null;
  added: number;
  removed: number;
  /** False when the counts are 0 only because nothing was supplied. */
  countsKnown: boolean;
  annotations: ResolvableAnnotation[];
  /** This file came out of a multi-file diff the model pasted into one entry. */
  split: boolean;
};

/** Expanded files beyond this are dropped (a pasted `git diff` can hold hundreds). */
export const MAX_RESOLVED_FILES = 40;

/** Comments shown per file; extras are dropped rather than rejected. */
export const MAX_ANNOTATIONS_PER_FILE = 8;

function resolveOne(
  file: ResolvableFile,
  key: string,
  diffText: string | null,
  split: boolean
): ResolvedFile {
  const parsed = diffText ? parseUnifiedDiff(diffText) : null;
  const hasHunks = (parsed?.hunks.length ?? 0) > 0;
  // The diff's own paths only fill gaps for a split part; the model's `path` is otherwise shown.
  const headerPath = parsed?.newPath ?? parsed?.oldPath ?? null;
  const path = split && headerPath ? headerPath : file.path;
  const declaredOld = file.oldPath ?? null;
  const status: DiffFileStatus =
    parsed?.status ??
    file.status ??
    (declaredOld !== null && declaredOld !== path ? "renamed" : "modified");
  const oldPath =
    status === "renamed"
      ? ([declaredOld, parsed?.oldPath ?? null].find(
          (candidate) => candidate && candidate !== path
        ) ?? null)
      : null;
  const supplied = file.added !== undefined || file.removed !== undefined;

  return {
    key,
    path,
    oldPath,
    status,
    note: file.note ?? null,
    diffText,
    parsed,
    added: hasHunks ? parsed!.added : (file.added ?? 0),
    removed: hasHunks ? parsed!.removed : (file.removed ?? 0),
    countsKnown: hasHunks || supplied,
    annotations: (file.annotations ?? [])
      .filter((annotation) => annotation.text.trim() !== "")
      .slice(0, MAX_ANNOTATIONS_PER_FILE),
    split,
  };
}

export function resolveCodeDiffFiles(files: readonly ResolvableFile[]): ResolvedFile[] {
  const out: ResolvedFile[] = [];

  files.forEach((file, index) => {
    const parts = file.diff ? splitUnifiedDiff(file.diff) : [];

    if (parts.length <= 1) {
      out.push(resolveOne(file, `f${index}`, parts[0] ?? null, false));

      return;
    }

    parts.forEach((part, partIndex) => {
      // Note and comments belong to the file the model described: the first part.
      const own: ResolvableFile =
        partIndex === 0 ? file : { path: file.path, note: undefined, annotations: undefined };

      out.push(resolveOne(own, `f${index}.${partIndex}`, part, true));
    });
  });

  return out.slice(0, MAX_RESOLVED_FILES);
}
