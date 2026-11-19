import { describe, expect, test } from "bun:test";

import {
  audit,
  formatReport,
  globToRegExp,
  importedNames,
  loadTokens,
  parseDiff,
  summarize,
  tokenHint,
  untrackedAsAdded,
  type FileDiff,
} from "../../scripts/design-guard";

const TOKENS = loadTokens(`
  --spacing-stack-xs: 0.25rem;
  --spacing-stack-sm: 0.5rem;
  --spacing-stack-md: 0.75rem;
  --spacing-stack-lg: 1rem;
  --spacing-inline-xs: 0.25rem;
  --spacing-inline-sm: 0.5rem;
  --spacing-inline-md: 0.75rem;
  --spacing-inset-md: 0.75rem;
`);

const ctx = (files: Record<string, string> = {}) => ({
  tokens: TOKENS,
  readFile: (p: string) => files[p],
});

const added = (file: string, ...lines: string[]): FileDiff => ({
  file,
  status: "modified",
  added: lines.map((text, i) => ({ line: i + 1, text })),
  removed: [],
});

const rulesOf = (files: FileDiff[], c = ctx(), scope?: string[]) =>
  audit(files, c, { scope }).map((f) => `${f.severity}:${f.rule}`);

describe("parseDiff", () => {
  test("tracks new-file line numbers, statuses and removed lines", () => {
    const diff = [
      "diff --git a/components/a.tsx b/components/a.tsx",
      "--- a/components/a.tsx",
      "+++ b/components/a.tsx",
      "@@ -3,2 +3,2 @@",
      '-import Old from "@/components/old";',
      "-keep",
      "+const x = 1;",
      "+const y = 2;",
      "diff --git a/components/new.css b/components/new.css",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/components/new.css",
      "@@ -0,0 +1 @@",
      "+.a { gap: 6px; }",
    ].join("\n");
    const [a, n] = parseDiff(diff);
    expect(a!.added).toEqual([
      { line: 3, text: "const x = 1;" },
      { line: 4, text: "const y = 2;" },
    ]);
    expect(a!.removed).toHaveLength(2);
    expect(n!.status).toBe("added");
    expect(n!.added[0]).toEqual({ line: 1, text: ".a { gap: 6px; }" });
  });
});

describe("literal lengths in CSS", () => {
  test("flags the mistakes from the CoreInput session and names the ask", () => {
    const findings = audit(
      [added("components/chat/composer.module.css", ".row { gap: 6px; min-height: 2.75rem; line-height: 1.6em; }")],
      ctx()
    );
    const lengths = findings.filter((f) => f.rule === "literal-length");
    expect(lengths).toHaveLength(3);
    expect(lengths.every((f) => f.severity === "error")).toBe(true);
    // 6px has no token, 44px (2.75rem) is off the spacing scale, 1.6em depends on font size.
    expect(lengths.every((f) => f.ask)).toBe(true);
    expect(lengths[0]!.hint).toContain("no token at 6px");
  });

  test("names the matching token, and does not ask, when a value is on the scale", () => {
    const [f] = audit([added("a.module.css", ".a { padding: 12px; }")], ctx());
    expect(f!.hint).toContain("stack-md / inline-md / inset-md");
    expect(f!.ask).toBe(false);
  });

  test("exempts zero, hairline borders, media queries, full-viewport units and comments", () => {
    const lines = [
      ".a { margin: 0px; }",
      ".a { border: 1px solid var(--border); }",
      "@media (min-width: 640px) {",
      ".a { height: 100dvh; }",
      "/* a 6px gap used to live here */",
      " * 8px in a JSDoc line",
      '.a { background: url("/x/12px.png"); }',
    ];
    expect(rulesOf([added("a.module.css", ...lines)])).toEqual([]);
  });

  test("a non-spacing property is a warning, not an error", () => {
    expect(rulesOf([added("a.module.css", ".a { transform: translateY(-4px); }")])).toEqual([
      "warn:literal-length",
    ]);
  });

  test("token definition files may hold literals; other files may not", () => {
    const line = "  --spacing-stack-md: 0.75rem;";
    expect(rulesOf([added("styles/globals.css", line)])).toEqual([]);
    expect(rulesOf([added("components/x.module.css", line)])).toEqual(["warn:literal-length"]);
  });
});

describe("Tailwind and inline styles in TSX", () => {
  test("flags arbitrary lengths and colors but not variable-backed ones", () => {
    const f = audit(
      [
        added(
          "components/x.tsx",
          '<div className="gap-[6px] w-[var(--composer-width)] sm:p-[2.75rem] bg-[#ff00aa]" />'
        ),
      ],
      ctx()
    );
    expect(f.map((x) => x.rule)).toEqual(["arbitrary-value", "arbitrary-value", "arbitrary-color"]);
    expect(f[0]!.hint).toContain("no token at 6px");
  });

  test("z-index and timing arbitraries are warnings", () => {
    expect(rulesOf([added("components/x.tsx", '<div className="z-[99] duration-[200ms]" />')])).toEqual([
      "warn:arbitrary-z",
      "warn:timing-literal",
    ]);
  });

  test("numbers in a style prop are flagged; image dimensions in data are not", () => {
    expect(rulesOf([added("components/x.tsx", "<div style={{ width: 320 }} />")])).toEqual([
      "error:inline-style-literal",
    ]);
    expect(rulesOf([added("content/blog/post.tsx", "  height: 198,")])).toEqual([]);
    expect(rulesOf([added("components/x.tsx", '<div style={{ gap: "6px" }} />')])).toEqual([
      "error:inline-style-literal",
    ]);
  });
});

describe("colors, hover, focus and shadows", () => {
  test("hex and rgb literals are errors; token-backed color functions are not", () => {
    expect(rulesOf([added("a.module.css", ".a { color: #1a1a1a; border-color: rgba(0, 0, 0, 0.2); }")])).toEqual([
      "error:color-literal",
      "error:color-literal",
    ]);
    expect(
      rulesOf([added("a.module.css", ".a { color: rgb(var(--x)); background: color-mix(in oklab, var(--a) 40%, transparent); }")])
    ).toEqual([]);
  });

  test("a white or palette hover fill is the Lumen violation; a resting hue is a warning", () => {
    expect(rulesOf([added("components/x.tsx", '<b className="hover:bg-white" />')])).toEqual([
      "error:hover-fill-color",
    ]);
    expect(rulesOf([added("components/x.tsx", '<b className="hover:bg-teal-500/20" />')])).toEqual([
      "error:hover-fill-color",
    ]);
    expect(rulesOf([added("components/x.tsx", '<b className="text-teal-400" />')])).toEqual(["warn:palette-color"]);
  });

  test("focus rings are errors; removing an outline needs organic-focus", () => {
    expect(rulesOf([added("components/x.tsx", '<b className="focus-visible:ring-2" />')])).toEqual([
      "error:focus-ring",
    ]);
    expect(rulesOf([added("components/x.tsx", '<b className="outline-none" />')])).toEqual(["warn:focus-removed"]);
    expect(rulesOf([added("components/x.tsx", '<b className="outline-none organic-focus" />')])).toEqual([]);
  });

  test("a new box-shadow asks about the Lumen steps; Lumen variables pass", () => {
    const f = audit([added("a.module.css", ".a { box-shadow: 0 2px 8px rgba(0,0,0,.2); }")], ctx());
    expect(f.map((x) => x.rule)).toEqual(["color-literal", "shadow-literal"]);
    expect(f.find((x) => x.rule === "shadow-literal")!.ask).toBe(true);
    expect(rulesOf([added("a.module.css", ".a { box-shadow: var(--lumen-shadow-rest); }")])).toEqual([]);
  });

  test("timing literals are warnings outside timing homes", () => {
    expect(rulesOf([added("components/x.module.css", ".a { transition: opacity 200ms ease; }")])).toEqual([
      "warn:timing-literal",
    ]);
    expect(rulesOf([added("components/chat/composer-reflow.module.css", ".a { transition: opacity 200ms ease; }")])).toEqual([]);
  });
});

describe("suppression", () => {
  test("an allow marker with a reason suppresses its line, the next-line form suppresses the next", () => {
    const f: FileDiff = added(
      "a.module.css",
      ".a { gap: 6px; } /* design-guard: allow owner approved one-off, COA-1 */",
      "/* design-guard: allow-next-line owner approved one-off, COA-1 */",
      ".b { gap: 6px; }",
      ".c { gap: 6px; }"
    );
    expect(audit([f], ctx()).map((x) => x.line)).toEqual([4]);
  });

  test("a marker without a reason is itself an error", () => {
    expect(rulesOf([added("a.module.css", ".a { gap: 6px; } /* design-guard: allow */")])).toContain(
      "error:allow-without-reason"
    );
  });
});

describe("scope and swaps", () => {
  const files: FileDiff[] = [
    added("components/chat/composer.tsx", "const a = 1;"),
    added("tests/unit/composer.test.tsx", "const a = 1;"),
    added("components/chat/attachments.tsx", "const a = 1;"),
    { file: "package.json", status: "modified", added: [], removed: [] },
  ];

  test("flags changed files the request did not name, but not tests of in-scope files", () => {
    const f = audit(files, ctx(), { scope: ["components/chat/composer.tsx"] }).filter((x) => x.rule === "scope-creep");
    expect(f.map((x) => x.file).sort()).toEqual(["components/chat/attachments.tsx", "package.json"]);
  });

  test("scope globs and directories", () => {
    expect(globToRegExp("components/chat/**").test("components/chat/a/b.tsx")).toBe(true);
    expect(globToRegExp("components/chat/*.tsx").test("components/chat/a/b.tsx")).toBe(false);
    expect(globToRegExp("components/chat").test("components/chat/a.tsx")).toBe(true);
    expect(globToRegExp("components/chat").test("components/chatty.tsx")).toBe(false);
  });

  test("an import that stopped being used is a swap; one still used is not", () => {
    const swapped: FileDiff = {
      file: "components/chat/composer.tsx",
      status: "modified",
      added: [],
      removed: ['import AttachmentsButton from "@/components/chat/attachments-button";'],
    };
    const gone = audit([swapped], ctx({ "components/chat/composer.tsx": "<input type=file />" }));
    expect(gone.map((f) => f.rule)).toEqual(["component-swap"]);
    const kept = audit([swapped], ctx({ "components/chat/composer.tsx": "<AttachmentsButton />" }));
    expect(kept).toEqual([]);
  });

  test("a removed Lumen or focus treatment that nothing replaces is flagged", () => {
    const f: FileDiff = {
      file: "components/chat/x.tsx",
      status: "modified",
      added: [{ line: 1, text: '<b className="rounded-md" />' }],
      removed: ['<b className="organic-lumen-interactive rounded-md" />'],
    };
    expect(rulesOf([f])).toEqual(["warn:interaction-removed"]);
  });

  test("importedNames reads default, named, aliased and namespace imports", () => {
    expect(importedNames("A, { B, type C, D as E }")).toEqual(["B", "C", "E", "A"]);
    expect(importedNames("* as N")).toEqual(["N"]);
  });
});

describe("tokens and report", () => {
  test("loadTokens reads the spacing scale from the @theme block", () => {
    expect(TOKENS.spacingPx.get(12)).toEqual(["stack-md", "inline-md", "inset-md"]);
    expect(TOKENS.spacingPx.get(4)).toEqual(["stack-xs", "inline-xs"]);
  });

  test("tokenHint points at the Tailwind scale for 4px multiples", () => {
    const h = tokenHint(44, TOKENS);
    expect(h.ask).toBe(true);
    expect(h.hint).toContain("-11 is 44px");
  });

  test("untracked files audit as all-added with real line numbers", () => {
    const f = audit([untrackedAsAdded("components/n.module.css", ".a {\n  gap: 6px;\n}")], ctx());
    expect(f[0]!.line).toBe(2);
  });

  test("the report groups by file and ends with a count and the ask reminder", () => {
    const f = audit([added("a.module.css", ".a { gap: 6px; }")], ctx());
    const report = formatReport(f, 1);
    expect(report).toContain("a.module.css");
    expect(report).toContain("1 error(s), 0 warning(s) in 1 file(s)");
    expect(report).toContain("[ask]");
    expect(summarize(f).errors).toBe(1);
    expect(formatReport([], 5)).toBe("design-guard: clean (5 added lines audited)");
  });
});
