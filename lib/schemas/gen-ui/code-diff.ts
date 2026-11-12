import { z } from "zod";

import { GEN_UI_VERSION } from "./shared";

import { MAX_ANNOTATIONS_PER_FILE, resolveCodeDiffFiles } from "@/lib/diff/resolve-file";

/**
 * Code diff block. The model supplies standard unified-diff text per file; the app parses it,
 * counts lines, derives added / deleted / renamed, pairs lines for intra-line emphasis and folds
 * long context (`components/chat/gen-ui/diff/`). Nothing structural is asked of the model.
 *
 * Limits that protect the app are enforced (files, diff size); soft text is shortened rather than
 * rejected, so one long sentence never throws away a whole tool call.
 */
export const CODE_DIFF_LIMITS = {
  files: 12,
  diffChars: 30_000,
  annotationsPerFile: MAX_ANNOTATIONS_PER_FILE,
  title: 120,
  summary: 600,
  path: 300,
  note: 240,
  annotationText: 400,
  annotationMatch: 120,
} as const;

/** Shortens instead of rejecting: over-long prose is the model's habit, not an invalid call. */
function softText(max: number) {
  return z
    .string()
    .transform((value) => (value.length > max ? `${value.slice(0, max - 1)}…` : value));
}

export const CodeDiffAnnotationKindSchema = z.enum(["note", "issue", "suggestion"]);

export const CodeDiffAnnotationSchema = z.object({
  line: z
    .number()
    .int()
    .min(1)
    .max(10_000_000)
    .optional()
    .catch(undefined)
    .describe(
      "Line number the comment is about, in the NEW file (or the OLD file when side is 'old'). Omit it unless you are sure; models miscount, so prefer `match`."
    ),
  side: z
    .enum(["new", "old"])
    .optional()
    .catch(undefined)
    .describe("'new' (default) for an added or unchanged line; 'old' for a line the diff removes."),
  match: softText(CODE_DIFF_LIMITS.annotationMatch)
    .optional()
    .catch(undefined)
    .describe(
      `A short snippet (≤${CODE_DIFF_LIMITS.annotationMatch} chars) copied from the line the comment is about. The app finds the line; use this whenever you are not certain of the line number. With neither \`line\` nor \`match\`, the comment attaches to the file.`
    ),
  kind: CodeDiffAnnotationKindSchema.optional()
    .catch(undefined)
    .describe(
      "'note' (default) explains; 'issue' flags a problem; 'suggestion' proposes a change. Shown as a word, not only a colour."
    ),
  text: softText(CODE_DIFF_LIMITS.annotationText)
    .pipe(z.string().min(1))
    .describe(
      `The comment, plain text (no markdown, no HTML), ≤${CODE_DIFF_LIMITS.annotationText} chars. One or two sentences.`
    ),
});

export type CodeDiffAnnotation = z.infer<typeof CodeDiffAnnotationSchema>;

export const CodeDiffFileSchema = z.object({
  path: softText(CODE_DIFF_LIMITS.path)
    .pipe(z.string().min(1))
    .describe(
      `Required. Repository path of the file after the change (the old path when it was deleted), ≤${CODE_DIFF_LIMITS.path} chars, e.g. "lib/memory/search.ts". Shown as text only; never a link. If the real path is unknown use the best name you have, such as "env (config)".`
    ),
  oldPath: softText(CODE_DIFF_LIMITS.path)
    .optional()
    .catch(undefined)
    .describe(
      "Only for a rename or move: the previous path. Leave out otherwise. The diff's own rename headers are used when present."
    ),
  status: z
    .enum(["added", "modified", "deleted", "renamed"])
    .optional()
    .catch(undefined)
    .describe(
      "Normally leave out: the app reads added / deleted / renamed from the diff. Set it only when you give no `diff` (a file you describe but do not show)."
    ),
  diff: z
    .string()
    .max(CODE_DIFF_LIMITS.diffChars)
    // No .catch here: an over-long or non-text diff must fail the call so the model retries,
    // not vanish silently and leave a file that looks like it had no change.
    .optional()
    .describe(
      `Unified diff of ONE file, as \`git diff\` prints it: hunks start with '@@', every line begins with ' ' (unchanged), '+' (added) or '-' (removed). The 'diff --git', 'index', '---' and '+++' header lines are optional. Hunk counts after '@@' may be wrong or missing; if you do not know the starting line numbers write a bare '@@' (do NOT guess them). Copy real changed lines; keep about 3 unchanged lines of context around each change. ≤${CODE_DIFF_LIMITS.diffChars} chars. Omit for binary, generated, lockfile or huge changes and give \`note\` plus \`added\`/\`removed\` instead. NEVER include real secrets, tokens, passwords or private keys: write '***' for any secret value.`
    ),
  added: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .optional()
    .catch(undefined)
    .describe("Lines added. Only when `diff` is omitted; otherwise the app counts them."),
  removed: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .optional()
    .catch(undefined)
    .describe("Lines removed. Only when `diff` is omitted; otherwise the app counts them."),
  note: softText(CODE_DIFF_LIMITS.note)
    .optional()
    .catch(undefined)
    .describe(
      `One plain-text line (≤${CODE_DIFF_LIMITS.note} chars) on what this file's change does, e.g. "Retries the request once on 429." Needed when you give no diff.`
    ),
  annotations: z
    // A comment that fails to parse becomes { text: "" } and is dropped when the file is resolved.
    .array(CodeDiffAnnotationSchema.catch({ text: "" }))
    .optional()
    .catch(undefined)
    .describe(
      `Comments anchored to lines of this file, at most ${CODE_DIFF_LIMITS.annotationsPerFile}. Use for review feedback or to explain the one or two lines that matter; do not annotate every line.`
    ),
});

export type CodeDiffFile = z.infer<typeof CodeDiffFileSchema>;

export const CodeDiffBlockSchema = z.object({
  type: z.literal("code-diff"),
  version: GEN_UI_VERSION,
  title: softText(CODE_DIFF_LIMITS.title)
    .optional()
    .catch(undefined)
    .describe(
      `What changed, in one line (≤${CODE_DIFF_LIMITS.title} chars), e.g. "Retry search on rate limit". Optional.`
    ),
  summary: softText(CODE_DIFF_LIMITS.summary)
    .optional()
    .catch(undefined)
    .describe(
      `Why it changed and what to watch for, plain text (no markdown), ≤${CODE_DIFF_LIMITS.summary} chars. Do not restate the diff line by line. Optional.`
    ),
  files: z
    .array(CodeDiffFileSchema)
    .min(1)
    .max(CODE_DIFF_LIMITS.files)
    .describe(
      `One entry per changed file, 1 to ${CODE_DIFF_LIMITS.files}, most important first. Pasting a whole multi-file \`git diff\` into one entry also works (it is split by file), but separate entries are preferred. For a larger change, show the key files and set \`moreFiles\`.`
    ),
  moreFiles: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .optional()
    .catch(undefined)
    .describe("Number of further changed files you left out of `files`. Optional."),
});

export type CodeDiffBlock = z.infer<typeof CodeDiffBlockSchema>;

/** Plain-text label for the block, used for a11y names and the registry title. */
export function codeDiffTitle(block: Pick<CodeDiffBlock, "title" | "files">): string {
  if (block.title) return block.title;

  const first = block.files[0]?.path;

  if (!first) return "Code changes";

  return block.files.length > 1 ? `Changes to ${first} and ${block.files.length - 1} more` : first;
}

function longestBacktickRun(content: string): number {
  return (content.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
}

/** A fence long enough that nothing inside can close it early. */
function fenceFor(content: string): string {
  return "`".repeat(Math.max(3, longestBacktickRun(content) + 1));
}

/** Inline code span that survives backticks in the text (paths are untrusted). */
function inlineCode(value: string): string {
  const flat = value.replace(/[\r\n]+/g, " ");
  const tick = "`".repeat(longestBacktickRun(flat) + 1);
  const padded = flat.startsWith("`") || flat.endsWith("`") ? ` ${flat} ` : flat;

  return `${tick}${padded}${tick}`;
}

const STATUS_WORD = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
} as const;

export function codeDiffToMarkdown(block: CodeDiffBlock): string {
  const files = resolveCodeDiffFiles(block.files);
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);
  const lines: string[] = [`## ${codeDiffTitle(block).replace(/[\r\n]+/g, " ")}`, ""];

  if (block.summary) lines.push(block.summary, "");

  const more = block.moreFiles ? ` (${block.moreFiles} more not shown)` : "";

  lines.push(
    `${files.length} ${files.length === 1 ? "file" : "files"} changed, +${added} −${removed}${more}`,
    ""
  );

  for (const file of files) {
    const move = file.oldPath ? ` from ${inlineCode(file.oldPath)}` : "";

    lines.push(
      `### ${inlineCode(file.path)} — ${STATUS_WORD[file.status]}${move} (+${file.added} −${file.removed})`,
      ""
    );
    if (file.note) lines.push(file.note, "");

    if (file.diffText) {
      const fence = fenceFor(file.diffText);

      lines.push(`${fence}diff`, file.diffText, fence, "");
    }

    for (const annotation of file.annotations) {
      const where =
        annotation.line !== undefined
          ? `line ${annotation.line}${annotation.side === "old" ? " (old)" : ""}`
          : annotation.match
            ? `near ${inlineCode(annotation.match)}`
            : "file";

      lines.push(
        `- ${annotation.kind ?? "note"} (${where}): ${annotation.text.replace(/[\r\n]+/g, " ")}`
      );
    }
    if (file.annotations.length > 0) lines.push("");
  }

  return lines.join("\n").trim();
}

export function codeDiffToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" && raw.title ? raw.title : "Code changes";

  return `## ${title.replace(/[\r\n]+/g, " ")}\n\n_(Code diff — structured view unavailable)_`;
}
