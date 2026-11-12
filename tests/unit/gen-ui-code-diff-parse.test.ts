import { describe, expect, test } from "bun:test";

import {
  normalizeDiffText,
  parseUnifiedDiff,
  splitUnifiedDiff,
} from "@/lib/diff/parse-unified";
import { MAX_ANNOTATIONS_PER_FILE, resolveCodeDiffFiles } from "@/lib/diff/resolve-file";

const rows = (...lines: string[]) => lines.join("\n");

describe("parseUnifiedDiff: structure", () => {
  test("a modified file: counts come from the lines, numbers from the hunk starts", () => {
    const parsed = parseUnifiedDiff(
      rows(
        "diff --git a/src/a.ts b/src/a.ts",
        "index 1111111..2222222 100644",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -10,4 +10,5 @@ function main() {",
        " keep",
        "-old",
        "+new",
        "+extra",
        " tail"
      )
    );

    expect(parsed.recognized).toBe(true);
    expect(parsed.oldPath).toBe("src/a.ts");
    expect(parsed.newPath).toBe("src/a.ts");
    // Nothing in the text proves "modified", so the parser does not claim it.
    expect(parsed.status).toBeNull();
    expect(parsed.added).toBe(2);
    expect(parsed.removed).toBe(1);
    expect(parsed.lineCount).toBe(5);
    const [hunk] = parsed.hunks;

    expect(hunk?.section).toBe("function main() {");
    expect(hunk?.lines.map((l) => [l.kind, l.oldNo, l.newNo])).toEqual([
      ["context", 10, 10],
      ["del", 11, null],
      ["add", null, 11],
      ["add", null, 12],
      ["context", 12, 13],
    ]);
  });

  test("an added file is proven by /dev/null, by file mode, or by a -0,0 hunk", () => {
    const withHeaders = parseUnifiedDiff(
      rows("--- /dev/null", "+++ b/new.ts", "@@ -0,0 +1,2 @@", "+one", "+two")
    );

    expect(withHeaders.status).toBe("added");
    expect(withHeaders.oldPath).toBeNull();
    expect(withHeaders.newPath).toBe("new.ts");
    expect(parseUnifiedDiff(rows("new file mode 100644", "@@ -0,0 +1 @@", "+one")).status).toBe(
      "added"
    );
    // No headers at all: the hunk alone says it.
    expect(parseUnifiedDiff(rows("@@ -0,0 +1,2 @@", "+one", "+two")).status).toBe("added");
  });

  test("a deleted file is proven by /dev/null, by file mode, or by a +0,0 hunk", () => {
    const parsed = parseUnifiedDiff(
      rows("--- a/gone.ts", "+++ /dev/null", "@@ -1,2 +0,0 @@", "-one", "-two")
    );

    expect(parsed.status).toBe("deleted");
    expect(parsed.newPath).toBeNull();
    expect(parsed.removed).toBe(2);
    expect(parseUnifiedDiff(rows("@@ -1,2 +0,0 @@", "-one", "-two")).status).toBe("deleted");
    expect(parseUnifiedDiff(rows("deleted file mode 100644", "@@ -1 +0,0 @@", "-x")).status).toBe(
      "deleted"
    );
  });

  test("a rename with similarity, and a rename with no hunks at all, are recognised", () => {
    const withEdits = parseUnifiedDiff(
      rows(
        "diff --git a/old.ts b/new.ts",
        "similarity index 94%",
        "rename from old.ts",
        "rename to new.ts",
        "--- a/old.ts",
        "+++ b/new.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b"
      )
    );

    expect(withEdits.status).toBe("renamed");
    expect(withEdits.oldPath).toBe("old.ts");
    expect(withEdits.newPath).toBe("new.ts");
    expect(withEdits.similarity).toBe(94);

    const pure = parseUnifiedDiff(
      rows("diff --git a/x.md b/y.md", "similarity index 100%", "rename from x.md", "rename to y.md")
    );

    expect(pure.recognized).toBe(true);
    expect(pure.status).toBe("renamed");
    expect(pure.hunks).toHaveLength(0);
  });

  test("renames are also read from differing ---/+++ paths", () => {
    const parsed = parseUnifiedDiff(rows("--- a/one.ts", "+++ b/two.ts", "@@ -1 +1 @@", "-a", "+b"));

    expect(parsed.status).toBe("renamed");
  });

  test("a binary file is recognised and has no hunks", () => {
    const parsed = parseUnifiedDiff("Binary files a/logo.png and b/logo.png differ");

    expect(parsed.binary).toBe(true);
    expect(parsed.recognized).toBe(true);
    expect(parsed.hunks).toHaveLength(0);
    expect(parseUnifiedDiff("Binary files /dev/null and b/logo.png differ").status).toBe("added");
    expect(parseUnifiedDiff(rows("diff --git a/x b/x", "GIT binary patch", "literal 12")).binary).toBe(
      true
    );
  });

  test("a mode-only change is recognised", () => {
    const parsed = parseUnifiedDiff(
      rows("diff --git a/run.sh b/run.sh", "old mode 100644", "new mode 100755")
    );

    expect(parsed.recognized).toBe(true);
    expect(parsed.modeChange).toEqual({ from: "100644", to: "100755" });
    expect(parsed.status).toBeNull();
  });

  test("'\\ No newline at end of file' marks the previous line and is not a line itself", () => {
    const parsed = parseUnifiedDiff(
      rows("@@ -1 +1 @@", "-a", "\\ No newline at end of file", "+b", "\\ No newline at end of file")
    );
    const lines = parsed.hunks[0]!.lines;

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.noNewline)).toEqual([true, true]);
    expect(parsed.lineCount).toBe(2);
  });
});

describe("parseUnifiedDiff: imperfect model output", () => {
  test("hunk counts are never trusted", () => {
    const parsed = parseUnifiedDiff(rows("@@ -1,2 +1,99 @@", " a", "-b", "+c"));
    const hunk = parsed.hunks[0]!;

    expect([hunk.oldCount, hunk.newCount]).toEqual([2, 2]);
    expect(hunk.lines.map((l) => l.newNo)).toEqual([1, null, 2]);
  });

  test("a bare @@ gives a hunk with no line numbers rather than guessed ones", () => {
    const parsed = parseUnifiedDiff(rows("@@", " a", "-b", "+c"));
    const hunk = parsed.hunks[0]!;

    expect(hunk.oldStart).toBeNull();
    expect(hunk.lines.every((l) => l.oldNo === null && l.newNo === null)).toBe(true);
    expect(parsed.added).toBe(1);
  });

  test("no @@ at all: +/- lines still make one hunk of unknown position", () => {
    const parsed = parseUnifiedDiff(rows("-const a = 1;", "+const a = 2;"));

    expect(parsed.recognized).toBe(true);
    expect(parsed.hunks).toHaveLength(1);
    expect([parsed.added, parsed.removed]).toEqual([1, 1]);
  });

  test("context that lost its leading space is kept as context", () => {
    const parsed = parseUnifiedDiff(rows("@@ -1,3 +1,3 @@", "plain", "-b", "+c", ""));

    expect(parsed.hunks[0]!.lines.map((l) => [l.kind, l.text])).toEqual([
      ["context", "plain"],
      ["del", "b"],
      ["add", "c"],
    ]);
  });

  test("a removed line that starts with '-- ' is content, not a file header", () => {
    const parsed = parseUnifiedDiff(
      rows("@@ -1,3 +1,3 @@", " SELECT 1;", "--- old comment", "+-- new comment")
    );

    expect(parsed.hunks[0]!.lines.map((l) => [l.kind, l.text])).toEqual([
      ["context", "SELECT 1;"],
      ["del", "-- old comment"],
      ["add", "-- new comment"],
    ]);
  });

  test("a line starting with a backslash is content unless it is git's marker", () => {
    const parsed = parseUnifiedDiff(rows("@@ -1 +1 @@", "-a", "\\frac{1}{2}", "+b"));

    expect(parsed.hunks[0]!.lines.map((l) => l.text)).toEqual(["a", "\\frac{1}{2}", "b"]);
  });

  test("a surrounding markdown fence is removed, and a bare fence ends the diff", () => {
    const fenced = parseUnifiedDiff(rows("```diff", "@@ -1 +1 @@", "-a", "+b", "```"));

    expect(fenced.lineCount).toBe(2);

    const withProse = parseUnifiedDiff(
      rows("Here is the change:", "```diff", "@@ -1 +1 @@", "-a", "+b", "```", "- not a diff line")
    );

    expect(withProse.lineCount).toBe(2);
    expect(withProse.removed).toBe(1);
    // An opening fence whose closer never arrived (a cut-off message) is still dropped.
    expect(normalizeDiffText(rows("```diff", "@@ -1 +1 @@", "-a"))).toBe(rows("@@ -1 +1 @@", "-a"));
  });

  test("CRLF, a BOM and double-escaped newlines are normalised", () => {
    expect(parseUnifiedDiff("﻿@@ -1 +1 @@\r\n-a\r\n+b\r\n").lineCount).toBe(2);
    expect(parseUnifiedDiff("@@ -1 +1 @@\\n-a\\n+b").lineCount).toBe(2);
  });

  test("text that is not a diff is reported as plain text, never thrown on", () => {
    const parsed = parseUnifiedDiff("I changed the retry logic to use exponential backoff.");

    expect(parsed.recognized).toBe(false);
    expect(parsed.plainText).toBe("I changed the retry logic to use exponential backoff.");
    expect(parsed.hunks).toHaveLength(0);
    expect(parseUnifiedDiff("").recognized).toBe(false);
    expect(parseUnifiedDiff(undefined as unknown as string).recognized).toBe(false);
    expect(parseUnifiedDiff("@@@@@").recognized).toBe(true);
  });

  test("a lone ---/+++ before any hunk is a header, not a one-line hunk", () => {
    const parsed = parseUnifiedDiff(rows("--- a/x.ts", "+++ b/x.ts", "@@ -1 +1 @@", "-a", "+b"));

    expect(parsed.lineCount).toBe(2);
    expect(parseUnifiedDiff(rows("+++ b/x.ts", "@@ -1 +1 @@", "-a", "+b")).newPath).toBe("x.ts");
  });
});

describe("splitUnifiedDiff", () => {
  test("a whole git diff pasted into one string splits into one part per file", () => {
    const parts = splitUnifiedDiff(
      rows(
        "diff --git a/a.ts b/a.ts",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "diff --git a/b.ts b/b.ts",
        "--- a/b.ts",
        "+++ b/b.ts",
        "@@ -1 +1 @@",
        "-c",
        "+d"
      )
    );

    expect(parts).toHaveLength(2);
    expect(parseUnifiedDiff(parts[0]!).newPath).toBe("a.ts");
    expect(parseUnifiedDiff(parts[1]!).newPath).toBe("b.ts");
  });

  test("a second ---/+++/@@ run (no diff --git line) also starts a new file", () => {
    const parts = splitUnifiedDiff(
      rows("--- a/a.ts", "+++ b/a.ts", "@@ -1 +1 @@", "-a", "+b", "--- a/b.ts", "+++ b/b.ts", "@@ -1 +1 @@", "-c", "+d")
    );

    expect(parts).toHaveLength(2);
    expect(parseUnifiedDiff(parts[1]!).newPath).toBe("b.ts");
  });

  test("one file stays one part, and a ---/+++ pair after its own diff --git does not split", () => {
    expect(splitUnifiedDiff(rows("diff --git a/a.ts b/a.ts", "--- a/a.ts", "+++ b/a.ts", "@@ -1 +1 @@", "-a", "+b"))).toHaveLength(1);
    expect(splitUnifiedDiff("")).toEqual([]);
    expect(splitUnifiedDiff("not a diff")).toEqual(["not a diff"]);
  });
});

describe("resolveCodeDiffFiles", () => {
  test("status: the diff's evidence beats the model's claim, which beats a default", () => {
    const [fromDiff, claimed, byOldPath, plain] = resolveCodeDiffFiles([
      { path: "a.ts", status: "modified", diff: rows("@@ -0,0 +1 @@", "+x") },
      { path: "b.ts", status: "deleted" },
      { path: "c.ts", oldPath: "old/c.ts" },
      { path: "d.ts" },
    ]);

    expect(fromDiff?.status).toBe("added");
    expect(claimed?.status).toBe("deleted");
    expect(byOldPath?.status).toBe("renamed");
    expect(byOldPath?.oldPath).toBe("old/c.ts");
    expect(plain?.status).toBe("modified");
    expect(plain?.oldPath).toBeNull();
  });

  test("stats are counted from the diff; supplied counts are used only without one", () => {
    const [counted, supplied, unknown] = resolveCodeDiffFiles([
      { path: "a.ts", added: 99, removed: 99, diff: rows("@@ -1 +1,2 @@", "-a", "+b", "+c") },
      { path: "lock", added: 120, removed: 80 },
      { path: "x.ts", note: "no numbers" },
    ]);

    expect([counted?.added, counted?.removed, counted?.countsKnown]).toEqual([2, 1, true]);
    expect([supplied?.added, supplied?.removed, supplied?.countsKnown]).toEqual([120, 80, true]);
    expect([unknown?.added, unknown?.countsKnown]).toEqual([0, false]);
  });

  test("a multi-file diff in one entry becomes one file per diff, keyed uniquely", () => {
    const files = resolveCodeDiffFiles([
      {
        path: "first.ts",
        note: "about the first",
        annotations: [{ text: "hello" }],
        diff: rows(
          "diff --git a/first.ts b/first.ts",
          "--- a/first.ts",
          "+++ b/first.ts",
          "@@ -1 +1 @@",
          "-a",
          "+b",
          "diff --git a/second.ts b/second.ts",
          "--- a/second.ts",
          "+++ b/second.ts",
          "@@ -1 +1 @@",
          "-c",
          "+d"
        ),
      },
    ]);

    expect(files.map((f) => f.path)).toEqual(["first.ts", "second.ts"]);
    expect(new Set(files.map((f) => f.key)).size).toBe(2);
    expect(files[0]?.note).toBe("about the first");
    expect(files[0]?.annotations).toHaveLength(1);
    expect(files[1]?.note).toBeNull();
    expect(files.every((f) => f.split)).toBe(true);
  });

  test("blank comments are dropped and the rest are capped", () => {
    const [file] = resolveCodeDiffFiles([
      {
        path: "a.ts",
        annotations: [
          { text: "" },
          { text: "   " },
          ...Array.from({ length: 20 }, (_, i) => ({ text: `c${i}` })),
        ],
      },
    ]);

    expect(file?.annotations).toHaveLength(MAX_ANNOTATIONS_PER_FILE);
    expect(file?.annotations[0]?.text).toBe("c0");
  });
});
