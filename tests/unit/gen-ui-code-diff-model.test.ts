import { describe, expect, test } from "bun:test";

import {
  buildFileView,
  computeEmphasis,
  displayText,
  FOLD_KEEP,
  hunkLabel,
  pickInitiallyOpen,
  resolveAnnotationTarget,
  revealHiddenChars,
  splitAtRange,
  statBlocks,
  type DiffRow,
  type DisplayLine,
} from "@/components/chat/gen-ui/diff/diff-model";
import { parseUnifiedDiff } from "@/lib/diff/parse-unified";
import type { ResolvableAnnotation } from "@/lib/diff/resolve-file";

const rows = (...lines: string[]) => lines.join("\n");
const context = (count: number, name = "c") =>
  Array.from({ length: count }, (_, i) => ` ${name}${i + 1}`);

function view(diff: string, annotations: ResolvableAnnotation[] = [], maxLines?: number) {
  return buildFileView({ parsed: parseUnifiedDiff(diff), annotations }, { maxLines });
}

function kinds(list: DiffRow[]) {
  return list.map((row) => (row.type === "line" ? row.line.kind : row.type));
}

describe("folding long unchanged runs", () => {
  test("a long run folds to FOLD_KEEP lines next to the change, on both sides", () => {
    const { rows: built } = view(
      rows("@@ -1,21 +1,21 @@", ...context(10, "before"), "-old", "+new", ...context(10, "after"))
    );

    expect(kinds(built)).toEqual([
      "hunk",
      "fold",
      ...Array(FOLD_KEEP).fill("context"),
      "del",
      "add",
      ...Array(FOLD_KEEP).fill("context"),
      "fold",
    ]);
    const folds = built.filter((row) => row.type === "fold");

    expect(folds.map((row) => (row.type === "fold" ? row.lines.length : 0))).toEqual([7, 7]);
    // The lines kept visible are the ones adjacent to the change.
    const visible = built.flatMap((row) => (row.type === "line" ? [row.line.text] : []));

    expect(visible).toEqual(["before8", "before9", "before10", "old", "new", "after1", "after2", "after3"]);
  });

  test("a gap between two changes keeps context at both ends and folds the middle", () => {
    const { rows: built } = view(rows("@@ -1,20 +1,20 @@", "-a", "+b", ...context(14), "-c", "+d"));
    const fold = built.find((row) => row.type === "fold");

    expect(fold?.type === "fold" && fold.lines.length).toBe(14 - 2 * FOLD_KEEP);
  });

  test("a fold that would hide fewer than three lines is not worth a row", () => {
    const { rows: built } = view(rows("@@ -1,10 +1,10 @@", "-a", "+b", ...context(2 * FOLD_KEEP + 2), "-c", "+d"));

    expect(built.some((row) => row.type === "fold")).toBe(false);
  });

  test("a hunk with no change in it is shown whole", () => {
    const { rows: built } = view(rows("@@ -1,12 +1,12 @@", ...context(12)));

    expect(built.some((row) => row.type === "fold")).toBe(false);
    expect(built.filter((row) => row.type === "line")).toHaveLength(12);
  });

  test("a commented line inside a long run stays visible and splits the fold", () => {
    const target = view(
      rows("@@ -1,21 +1,21 @@", ...context(10, "before"), "-old", "+new", ...context(10, "after")),
      [{ match: "before3", text: "look here" }]
    );
    const text = target.rows.flatMap((row) => (row.type === "line" ? [row.line.text] : []));

    expect(text).toContain("before3");
    const anchored = target.rows.find((row) => row.type === "line" && row.line.text === "before3");

    expect(anchored?.type === "line" && anchored.annotations).toHaveLength(1);
    expect(target.unplaced).toHaveLength(0);
  });

  test("text between hunks that the diff skips is counted, using the hunk numbers", () => {
    const { rows: built } = view(
      rows("@@ -1,3 +1,3 @@", " a", "-b", "+c", "@@ -20,3 +20,3 @@", " x", "-y", "+z")
    );
    const gap = built.find((row) => row.type === "gap");

    // The first hunk really holds 2 old lines (a, b), so it ends before line 3.
    expect(gap?.type === "gap" && gap.count).toBe(20 - (1 + 2));
    const before = view(rows("@@ -30,2 +30,2 @@", " a", "-b", "+c")).rows[0];

    expect(before?.type === "gap" && before.count).toBe(29);
  });
});

describe("caps and number columns", () => {
  test("lines over the per-file cap are counted, not rendered", () => {
    const result = view(rows("@@ -1,10 +1,10 @@", ...context(10)), [], 4);

    expect(result.rows.filter((row) => row.type === "line")).toHaveLength(4);
    expect(result.hiddenLines).toBe(6);
  });

  test("an added file has no old-number column; a headerless diff has none", () => {
    const added = view(rows("@@ -0,0 +1,2 @@", "+a", "+b"));

    expect([added.showOld, added.showNew]).toEqual([false, true]);
    const bare = view(rows("@@", "-a", "+b"));

    expect([bare.showOld, bare.showNew]).toEqual([false, false]);
  });

  test("digits follow the widest line number", () => {
    expect(view(rows("@@ -9998,2 +9998,2 @@", " a", "-b", "+c")).digits).toBe(4);
    expect(view(rows("@@ -1,2 +1,2 @@", " a", "-b", "+c")).digits).toBe(1);
  });

  test("hunk labels are recomputed from the lines, not copied from the header", () => {
    const hunk = parseUnifiedDiff(rows("@@ -5,99 +5,99 @@", " a", "-b", "+c")).hunks[0]!;

    expect(hunkLabel(hunk)).toBe("@@ -5,2 +5,2 @@");
    expect(hunkLabel({ oldStart: null, newStart: null, oldCount: 1, newCount: 1 })).toBe("@@");
  });
});

describe("in-line emphasis", () => {
  test("only the changed span is marked when most of the line is shared", () => {
    const result = computeEmphasis("  const maxAttempts = 1;", "  const maxAttempts = 3;");

    expect(result?.removed).toEqual([22, 23]);
    expect(result?.added).toEqual([22, 23]);
    expect(splitAtRange("  const maxAttempts = 3;", result!.added)).toEqual([
      "  const maxAttempts = ",
      "3",
      ";",
    ]);
  });

  test("an insertion marks only the added side", () => {
    const result = computeEmphasis("call(a)", "call(a, b)");

    expect(result?.removed).toBeNull();
    expect(result?.added).not.toBeNull();
  });

  test("lines that share too little get no emphasis: the whole line is the change", () => {
    expect(computeEmphasis("return updated > cutoff;", "if (Number.isNaN(updated)) throw new Error('bad');")).toBeNull();
    expect(computeEmphasis("same", "same")).toBeNull();
    expect(computeEmphasis("x".repeat(600), "y".repeat(600))).toBeNull();
  });

  test("a run of removed lines pairs with the run of added lines that follows", () => {
    const { rows: built } = view(
      rows("@@ -1,2 +1,2 @@", "-const a = 1;", "-const b = 2;", "+const a = 10;", "+const b = 20;")
    );
    const lines = built.flatMap((row) => (row.type === "line" ? [row.line] : []));

    expect(lines.map((l) => l.emphasis !== null)).toEqual([true, true, true, true]);
  });

  test("context lines and unpaired changes carry no emphasis", () => {
    const { rows: built } = view(rows("@@ -1,2 +1,2 @@", " keep", "-only removed", " keep"));

    expect(
      built.flatMap((row) => (row.type === "line" ? [row.line.emphasis] : []))
    ).toEqual([null, null, null]);
  });
});

describe("annotation placement", () => {
  const lines: DisplayLine[] = [
    { id: "0.0", kind: "context", text: "const retries = load();", oldNo: 10, newNo: 10, noNewline: false, emphasis: null, cut: false },
    { id: "0.1", kind: "del", text: "const retries = 1;", oldNo: 11, newNo: null, noNewline: false, emphasis: null, cut: false },
    { id: "0.2", kind: "add", text: "const retries = 3;", oldNo: null, newNo: 11, noNewline: false, emphasis: null, cut: false },
    { id: "0.3", kind: "add", text: "const retries = 3; // again", oldNo: null, newNo: 40, noNewline: false, emphasis: null, cut: false },
  ];
  const entries = lines.map((line) => ({ id: line.id, line }));
  const resolve = (annotation: Partial<ResolvableAnnotation>) =>
    resolveAnnotationTarget({ text: "x", ...annotation }, entries);

  test("a new-file line number finds the added or unchanged line, never a removed one", () => {
    expect(resolve({ line: 11 })).toBe("0.2");
    expect(resolve({ line: 10 })).toBe("0.0");
  });

  test("side: 'old' finds the removed line by its old number", () => {
    expect(resolve({ line: 11, side: "old" })).toBe("0.1");
    expect(resolve({ line: 11, side: "new" })).toBe("0.2");
  });

  test("with no side, a number that exists only on a removed line still finds it", () => {
    const onlyOld = [entries[1]!];

    expect(resolveAnnotationTarget({ text: "x", line: 11 }, onlyOld)).toBe("0.1");
  });

  test("match finds text on the line and prefers a changed line when there is no number", () => {
    expect(resolve({ match: "retries = 3" })).toBe("0.2");
    expect(resolve({ match: "load()" })).toBe("0.0");
    expect(resolve({ match: "  CONST   retries = 1" })).toBe("0.1");
  });

  test("match plus a number picks the matching line nearest that number", () => {
    expect(resolve({ match: "retries = 3", line: 40 })).toBe("0.3");
    expect(resolve({ match: "retries = 3", line: 12 })).toBe("0.2");
  });

  test("a wrong number falls back to the text; a wrong text falls back to the number", () => {
    expect(resolve({ line: 999, match: "load()" })).toBe("0.0");
    expect(resolve({ line: 11, match: "text that is nowhere" })).toBe("0.2");
  });

  test("nothing fits: the comment is unplaced, never dropped", () => {
    expect(resolve({ line: 999 })).toBeNull();
    expect(resolve({ match: "nowhere" })).toBeNull();
    expect(resolve({})).toBeNull();

    const result = view(rows("@@ -1 +1 @@", "-a", "+b"), [
      { text: "off the end", line: 500 },
      { text: "whole file" },
    ]);

    expect(result.unplaced.map((u) => u.annotation.text)).toEqual(["off the end", "whole file"]);
  });

  test("a comment on a line past the render cap is unplaced rather than lost", () => {
    const result = view(rows("@@ -1,10 +1,10 @@", ...context(10)), [{ text: "late", match: "c9" }], 4);

    expect(result.unplaced).toHaveLength(1);
  });
});

describe("policy helpers", () => {
  test("a single file always opens; later files open while they fit the budget", () => {
    expect(pickInitiallyOpen([5000])).toEqual([true]);
    // 30 + 60 + 60 = 150 fits the 160 budget; the next 60 does not; a later small file still fits.
    expect(pickInitiallyOpen([30, 60, 60, 60, 10])).toEqual([true, true, true, false, true]);
  });

  test("the first of several opens up to a readable size, files with no diff always count as open", () => {
    expect(pickInitiallyOpen([300, 10])).toEqual([true, false]);
    expect(pickInitiallyOpen([900, 10])).toEqual([false, true]);
    expect(pickInitiallyOpen([0, 900])).toEqual([true, false]);
  });

  test("the stat bar is five blocks proportioned by added vs removed", () => {
    expect(statBlocks(0, 0)).toEqual(["none", "none", "none", "none", "none"]);
    expect(statBlocks(10, 0)).toEqual(["add", "add", "add", "add", "add"]);
    expect(statBlocks(0, 10)).toEqual(["del", "del", "del", "del", "del"]);
    expect(statBlocks(1, 1000).filter((b) => b === "add")).toHaveLength(1);
    expect(statBlocks(1000, 1).filter((b) => b === "del")).toHaveLength(1);
    expect(statBlocks(3, 2)).toHaveLength(5);
  });

  test("hidden and direction-control characters become visible text", () => {
    const text = `a‮b​c\u0000d\te`;
    const { text: shown, found } = revealHiddenChars(text);

    expect(found).toBe(true);
    expect(shown).toBe("a‹U+202E›b‹U+200B›c‹U+0000›d\te");
    expect(revealHiddenChars("plain").found).toBe(false);
    expect(displayText("src/a\nb.ts")).toBe("src/a b.ts");
  });

  test("very long lines are shortened for display", () => {
    const result = view(rows("@@ -1 +1 @@", `-${"a".repeat(5000)}`, "+b"));
    const first = result.rows.find((row) => row.type === "line");

    expect(result.hasCutLines).toBe(true);
    expect(first?.type === "line" && first.line.text.length).toBeLessThan(2100);
  });
});
