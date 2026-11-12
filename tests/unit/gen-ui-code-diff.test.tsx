import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";

import { render } from "../helpers/render";

import { CodeDiff } from "@/components/chat/gen-ui/blocks/CodeDiff";
import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GenUISkeleton } from "@/components/chat/gen-ui/GenUISkeleton";
import type { CodeDiffBlock } from "@/lib/schemas/gen-ui";
import {
  CODE_DIFF_FIXTURES,
  FIXTURE_CODE_DIFF,
  FIXTURE_CODE_DIFF_CONFIG,
  FIXTURE_CODE_DIFF_LARGE,
  FIXTURE_CODE_DIFF_MALFORMED,
  FIXTURE_CODE_DIFF_PASTED,
  FIXTURE_CODE_DIFF_REFACTOR,
  FIXTURE_CODE_DIFF_REVIEW,
  FIXTURE_CODE_DIFF_SINGLE_FIX,
} from "@/lib/schemas/gen-ui/fixtures";

afterEach(cleanup);

type View = ReturnType<typeof render>;

/** A file's own header button (the file index and the copy button also mention the path). */
function toggleFor(view: View, path: string) {
  const matches = [...view.container.querySelectorAll("h4 > button")].filter((el) =>
    (el.textContent ?? "").startsWith(path)
  );

  expect(matches).toHaveLength(1);

  return matches[0] as HTMLButtonElement;
}

function regionFor(view: View, path: string) {
  return view.queryByRole("region", { name: `Diff of ${path}` });
}

function block(overrides: Partial<CodeDiffBlock> & Pick<CodeDiffBlock, "files">): CodeDiffBlock {
  return { type: "code-diff", version: 1, ...overrides };
}

describe("CodeDiff: the default showcase", () => {
  test("title, summary and counted stats come first; every file is a labelled section", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);

    expect(view.getByRole("heading", { level: 3, name: "Retry web search on rate limits" })).toBeTruthy();
    expect(view.getByText(/Exa answers 429 under load/)).toBeTruthy();
    expect(view.getByText("3 files changed")).toBeTruthy();
    expect(view.container.textContent).toContain("27 lines added, 3 lines removed");
    expect(view.getAllByRole("heading", { level: 4 })).toHaveLength(3);
    // Status is a word, not only a colour or a glyph.
    expect(within(toggleFor(view, "lib/exa/retry.ts")).getByText("Added")).toBeTruthy();
    expect(within(toggleFor(view, "lib/exa/client.ts")).getByText("Modified")).toBeTruthy();
  });

  test("added and removed lines carry +/− markers with accessible names, not only a tint", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);
    const region = regionFor(view, "lib/exa/client.ts")!;

    expect(within(region).getAllByLabelText("Added line")).toHaveLength(10);
    expect(within(region).getAllByLabelText("Removed line")).toHaveLength(3);
    const signs = [...region.querySelectorAll("td[aria-label]")].map((td) => td.textContent);

    expect(new Set(signs)).toEqual(new Set(["+", "−"]));
  });

  test("the changed span inside a paired line is emphasised and the rest is not", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);
    const marked = [...view.container.querySelectorAll('[data-emphasis="true"]')].map(
      (el) => el.textContent
    );

    expect(marked).toContain("1");
    expect(marked).toContain("3");
  });

  test("gutters show old and new line numbers from the hunk starts", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_SINGLE_FIX} />);
    const rows = [...regionFor(view, "lib/memory/recency.ts")!.querySelectorAll("tbody tr")].filter(
      // Gap and hunk rows span the table with one cell; code lines have four.
      (row) => row.querySelectorAll("td").length === 4
    );
    const numbers = rows.map((row) => [...row.querySelectorAll("td")].slice(0, 2).map((td) => td.textContent));

    expect(numbers[0]).toEqual(["22", "22"]);
    expect(numbers.some((pair) => pair[0] === "26" && pair[1] === "")).toBe(true);
    expect(numbers.some((pair) => pair[0] === "" && pair[1] === "26")).toBe(true);
  });

  test("a hunk head shows recomputed numbers and the enclosing function text", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_SINGLE_FIX} />);

    expect(view.getByText("@@ -22,7 +22,7 @@")).toBeTruthy();
    expect(view.getByText("export function filterMemoriesSince(")).toBeTruthy();
  });

  test("three or more files get an index; its buttons open a closed file and move focus to it", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);
    const nav = view.getByRole("navigation", { name: "Files changed" });
    const toggle = toggleFor(view, ".env.example");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(regionFor(view, ".env.example")).toBeNull();

    fireEvent.click(within(nav).getByRole("button", { name: /\.env\.example/ }));
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(regionFor(view, ".env.example")).not.toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  test("two files or fewer show no index", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_CONFIG} />);

    expect(view.queryByRole("navigation")).toBeNull();
  });

  test("expand / collapse all and wrap lines are native buttons holding only view state", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);
    const root = view.container.firstElementChild as HTMLElement;
    const wrap = view.getByRole("button", { name: "Wrap lines" });

    expect(wrap.getAttribute("aria-pressed")).toBe("false");
    expect(root.getAttribute("data-wrap")).toBeNull();
    fireEvent.click(wrap);
    expect(wrap.getAttribute("aria-pressed")).toBe("true");
    expect(root.getAttribute("data-wrap")).toBe("true");

    fireEvent.click(view.getByRole("button", { name: "Collapse all" }));
    expect(view.queryAllByRole("region")).toHaveLength(0);
    fireEvent.click(view.getByRole("button", { name: "Expand all" }));
    expect(view.queryAllByRole("region")).toHaveLength(3);
    // Rendering is unchanged by it: the same counts are still stated.
    expect(view.container.textContent).toContain("27 lines added, 3 lines removed");
  });

  test("every control is a native button; the only other tab stops are the scrollable code regions", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);

    expect(view.container.querySelectorAll("input, select, a, [role='button']")).toHaveLength(0);
    const stops = [...view.container.querySelectorAll("[tabindex]")];

    expect(stops.length).toBeGreaterThan(0);
    stops.forEach((el) => {
      expect(el.getAttribute("role")).toBe("region");
      expect(el.getAttribute("aria-label")).toMatch(/^(Diff of|Text for) /);
    });
    view.container.querySelectorAll("button").forEach((button) => {
      expect(button.hasAttribute("tabindex")).toBe(false);
    });
  });

  test("the card renders through the gen-UI registry", () => {
    const view = render(<GenUIRenderer data={{ block: FIXTURE_CODE_DIFF }} messageId="cd" />);

    expect(view.getByText("Retry web search on rate limits")).toBeTruthy();
    expect(view.getByText("3 files changed")).toBeTruthy();
  });

  test("the streaming skeleton has a code-diff shape instead of rendering nothing", () => {
    const view = render(<GenUISkeleton type="code-diff" />);

    expect(view.container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});

describe("CodeDiff: use cases", () => {
  test("rename, pure rename, deletion and importer: status, moved-from and no-change notices", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_REFACTOR} />);

    expect(within(toggleFor(view, "lib/memory/recency.ts")).getByText("Renamed")).toBeTruthy();
    expect(view.getByText("lib/memory/recent-memories.ts")).toBeTruthy();
    expect(view.getByText(/94% similar/)).toBeTruthy();
    expect(within(toggleFor(view, "docs/recency.md")).getByText("Renamed")).toBeTruthy();
    expect(view.getByText("Moved without line changes.")).toBeTruthy();
    expect(within(toggleFor(view, "lib/memory/legacy-recent.ts")).getByText("Deleted")).toBeTruthy();
    expect(
      within(regionFor(view, "lib/memory/legacy-recent.ts")!).getAllByLabelText("Removed line")
    ).toHaveLength(4);
    expect(within(toggleFor(view, "lib/llm/llm-tool-kit.ts")).getByText("Modified")).toBeTruthy();
  });

  test("config: a mode change is stated in words, and masked secrets stay masked", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_CONFIG} />);

    expect(view.getByText(/File mode changed from/)).toBeTruthy();
    expect(view.getByText("100755")).toBeTruthy();
    expect(view.getByText("Made executable.")).toBeTruthy();
    expect(view.container.textContent).toContain("EXA_API_KEY=***");
  });

  test("an added file has only new-side numbers and a single status word", () => {
    const view = render(
      <CodeDiff
        block={block({ files: [{ path: "new.ts", diff: "@@ -0,0 +1,2 @@\n+one\n+two" }] })}
      />
    );
    const lines = [...regionFor(view, "new.ts")!.querySelectorAll("tbody tr")].slice(1);

    expect(within(toggleFor(view, "new.ts")).getByText("Added")).toBeTruthy();
    // sign + code + one number column
    lines.forEach((row) => expect(row.querySelectorAll("td")).toHaveLength(3));
    expect(lines.map((row) => row.querySelector("td")?.textContent)).toEqual(["1", "2"]);
  });

  test("review: comments sit directly under the line they are about, by text or by number", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_REVIEW} />);
    const lineAbove = (text: string) =>
      view.getByText(text).closest("tr")?.previousElementSibling as HTMLElement;

    expect(lineAbove("This rethrows the raw SDK error. Callers expect a WebSearchError, so wrap it.").textContent).toContain(
      "throw error"
    );
    const newSide = lineAbove("Default raised from 1 to 3 attempts.");

    expect(newSide.textContent).toContain("maxAttempts = 3");
    expect(within(newSide).getByLabelText("Added line")).toBeTruthy();
    const oldSide = lineAbove("The old default never retried.");

    expect(oldSide.textContent).toContain("maxAttempts = 1");
    expect(within(oldSide).getByLabelText("Removed line")).toBeTruthy();
    // The kind is a word.
    expect(view.getByText("Issue")).toBeTruthy();
  });

  test("a comment that fits no shown line is listed under the file with where it was meant", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_REVIEW} />);

    expect(view.getByText("Comments not on a shown line")).toBeTruthy();
    expect(view.getByText("Suggestion · Line 900")).toBeTruthy();
    expect(view.getByText("Suggestion · This file")).toBeTruthy();
    expect(view.getByText(/points past the end of the diff/)).toBeTruthy();
  });

  test("large: a long unchanged run folds; its native button reveals and re-folds it", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_LARGE} />);

    expect(view.getByText("3 files changed · 31 more not shown")).toBeTruthy();
    expect(view.queryByText(/"tier29"/)).toBeNull();
    const fold = view.getByRole("button", { name: "Show 28 unchanged lines" });

    expect(fold.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(fold);
    expect(view.getByText(/"tier29"/)).toBeTruthy();
    const hide = view.getByRole("button", { name: "Hide 28 unchanged lines" });

    expect(hide.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(hide);
    expect(view.queryByText(/"tier29"/)).toBeNull();
  });

  test("large: a file with no diff is a plain row with its supplied counts; binary says so", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_LARGE} />);
    const lockRow = [...view.container.querySelectorAll("h4")].find((h) =>
      (h.textContent ?? "").startsWith("bun.lock")
    )!;

    expect(lockRow.querySelector("button")).toBeNull();
    expect(lockRow.textContent).toContain("1204 lines added, 980 lines removed");
    expect(view.getByText("Regenerated by the dependency bump.")).toBeTruthy();
    expect(view.getByText("No diff is shown for this file.")).toBeTruthy();
    expect(view.getByText(/Binary file changed/)).toBeTruthy();
  });

  test("a whole git diff pasted into one entry shows one section per file, with no-newline markers", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_PASTED} />);

    expect(view.getByText("2 files changed")).toBeTruthy();
    expect(toggleFor(view, "lib/exa/client.ts")).toBeTruthy();
    expect(toggleFor(view, "lib/exa/types.ts")).toBeTruthy();
    expect(view.getAllByText("No newline at end of file")).toHaveLength(2);
  });

  test("malformed output degrades: prose shows as text, a truncated hunk still renders", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_MALFORMED} />);

    expect(view.getByText(/not a unified diff/)).toBeTruthy();
    expect(view.getByRole("region", { name: "Text for notes.txt" }).textContent).toBe(
      "I changed the retry logic to use exponential backoff."
    );
    const region = regionFor(view, "src/truncated.ts")!;

    // The changed span is its own element, so match the row text rather than one node.
    expect(region.textContent).toContain("const b = 3");
    expect(within(region).getAllByLabelText("Removed line")).toHaveLength(1);
  });

  test("every fixture renders without throwing", () => {
    for (const fixture of CODE_DIFF_FIXTURES) {
      const view = render(<CodeDiff block={fixture} />);

      expect(view.container.textContent?.length).toBeGreaterThan(0);
      cleanup();
    }
  });

  test("a file that is long collapses by default and opens on request", () => {
    const longDiff = [
      "@@ -1,500 +1,500 @@",
      ...Array.from({ length: 250 }, (_, i) => `-old ${i}`),
      ...Array.from({ length: 250 }, (_, i) => `+new ${i}`),
    ].join("\n");
    const view = render(
      <CodeDiff
        block={block({
          files: [
            { path: "small.ts", diff: "@@ -1 +1 @@\n-a\n+b" },
            { path: "big.ts", diff: longDiff },
          ],
        })}
      />
    );

    expect(regionFor(view, "small.ts")).not.toBeNull();
    expect(regionFor(view, "big.ts")).toBeNull();
    fireEvent.click(toggleFor(view, "big.ts"));
    expect(regionFor(view, "big.ts")).not.toBeNull();
  });

  test("past the per-file cap the extra lines are counted, with the way to see all of it", () => {
    const diff = ["@@ -1,700 +1,700 @@", ...Array.from({ length: 700 }, (_, i) => `+line ${i}`)].join("\n");
    const view = render(<CodeDiff block={block({ files: [{ path: "huge.ts", diff }] })} />);

    expect(view.getByText(/100 more lines are not shown here/)).toBeTruthy();
    expect(within(regionFor(view, "huge.ts")!).getAllByLabelText("Added line")).toHaveLength(600);
  });
});

describe("CodeDiff: safety", () => {
  const hostile = block({
    title: "<img src=x onerror=alert(1)> title",
    summary: "<script>alert(1)</script>",
    files: [
      {
        path: "javascript:alert(1)//<b>x</b>.ts",
        note: "<a href='javascript:alert(1)'>click</a>",
        diff: [
          "@@ -1 +1 @@",
          '-<script>alert("old")</script>',
          '+<img src=x onerror=alert("new")>',
        ].join("\n"),
        annotations: [{ match: "onerror", text: "<iframe src=//evil></iframe>" }],
      },
    ],
  });

  test("model text is rendered as text: no markup, no links, no scripts", () => {
    const view = render(<CodeDiff block={hostile} />);

    expect(view.container.querySelector("script, img, iframe, b, a, style")).toBeNull();
    expect(view.container.querySelectorAll("[href], [src], [onerror]")).toHaveLength(0);
    expect(view.container.textContent).toContain("<img src=x onerror=alert(1)> title");
    expect(view.container.textContent).toContain('<script>alert("old")</script>');
    expect(view.container.textContent).toContain("<iframe src=//evil></iframe>");
    expect(view.container.textContent).toContain("javascript:alert(1)//<b>x</b>.ts");
  });

  test("invisible and direction-control characters are shown, with a notice", () => {
    const view = render(
      <CodeDiff
        block={block({
          files: [{ path: "a‮b.ts", diff: "@@ -1 +1 @@\n-ok\n+if (admin‮) {" }],
        })}
      />
    );

    expect(view.container.textContent).toContain("‹U+202E›");
    expect(view.container.textContent).not.toContain("‮");
    expect(view.getByText(/invisible or text-direction control characters/)).toBeTruthy();
  });
});

describe("CodeDiff: copy", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");

  afterEach(() => {
    if (original) Object.defineProperty(globalThis.navigator, "clipboard", original);
    else Reflect.deleteProperty(globalThis.navigator, "clipboard");
  });

  test("copies the diff as supplied and confirms it in text", async () => {
    const writeText = mock(async (_text: string) => {});

    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);

    fireEvent.click(view.getByRole("button", { name: "Copy diff of lib/exa/client.ts" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(FIXTURE_CODE_DIFF.files[0]!.diff!);
    // Assistive tech hears it too, through the polite live region.
    expect(view.getAllByRole("status").map((el) => el.textContent)).toContain("Diff copied");
  });

  test("says so when the clipboard is unavailable instead of failing silently", async () => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF_SINGLE_FIX} />);

    fireEvent.click(view.getByRole("button", { name: /Copy diff/ }));
    await waitFor(() => expect(view.getByRole("button", { name: "Copy failed" })).toBeTruthy());
  });
});

describe("Diff stylesheet guards", () => {
  const css = Bun.file("components/chat/gen-ui/diff/Diff.module.css").text();

  test("no focus rings outside forced-colours, and motion only under no-preference", async () => {
    const source = await css;
    const outsideForced = source.split("@media (forced-colors: active)")[0]!;

    expect(outsideForced).not.toMatch(/outline:\s*[^n\s]/);
    expect(outsideForced).not.toMatch(/box-shadow/);
    const motion = source.indexOf("@media (prefers-reduced-motion: no-preference)");

    expect(motion).toBeGreaterThan(-1);
    for (const match of source.matchAll(/transition:/g)) {
      expect(match.index!).toBeGreaterThan(motion);
    }
  });
});
