import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { GEN_UI_REGISTRY, getGenUIBlockTitle } from "@/components/chat/gen-ui/registry";
import {
  CODE_DIFF_LIMITS,
  CodeDiffBlockSchema,
  GEN_UI_BLOCK_TYPES,
  GenUIBlockSchema,
  codeDiffTitle,
  genUIBlockToMarkdown,
  genUIBlockToMarkdownLoose,
  safeParseGenUIBlock,
  type CodeDiffBlock,
} from "@/lib/schemas/gen-ui";
import {
  ALL_VALID_FIXTURES,
  CODE_DIFF_FIXTURES,
  FIXTURE_CODE_DIFF,
  FIXTURE_CODE_DIFF_REVIEW,
} from "@/lib/schemas/gen-ui/fixtures";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";

const valid = (extra: Record<string, unknown> = {}) => ({
  type: "code-diff",
  version: 1,
  files: [{ path: "a.ts", diff: "@@ -1 +1 @@\n-a\n+b" }],
  ...extra,
});

describe("code-diff schema", () => {
  test("is a registered block type with exactly one entry in the shared fixtures", () => {
    expect(GEN_UI_BLOCK_TYPES).toContain("code-diff");
    expect(ALL_VALID_FIXTURES.filter((b) => b.type === "code-diff")).toHaveLength(1);
    expect(GEN_UI_REGISTRY["code-diff"].label).toBe("Code diff");
  });

  test("every fixture passes the strict parse the render_gen_ui tool applies", () => {
    expect(CODE_DIFF_FIXTURES.length).toBeGreaterThanOrEqual(6);
    for (const block of CODE_DIFF_FIXTURES) {
      expect({ title: block.title, ok: GenUIBlockSchema.safeParse(block).success }).toEqual({
        title: block.title,
        ok: true,
      });
    }
  });

  test("the minimum a model must send is a file with a path", () => {
    const parsed = CodeDiffBlockSchema.safeParse({
      type: "code-diff",
      version: 1,
      files: [{ path: "src/a.ts" }],
    });

    expect(parsed.success).toBe(true);
  });

  test("enforced limits protect the app: files and diff size", () => {
    const file = { path: "a.ts" };

    expect(CodeDiffBlockSchema.safeParse(valid({ files: [] })).success).toBe(false);
    expect(
      CodeDiffBlockSchema.safeParse(
        valid({ files: Array.from({ length: CODE_DIFF_LIMITS.files + 1 }, () => file) })
      ).success
    ).toBe(false);
    expect(
      CodeDiffBlockSchema.safeParse(
        valid({ files: [{ path: "a.ts", diff: "x".repeat(CODE_DIFF_LIMITS.diffChars + 1) }] })
      ).success
    ).toBe(false);
    expect(
      CodeDiffBlockSchema.safeParse(
        valid({ files: [{ path: "a.ts", diff: "x".repeat(CODE_DIFF_LIMITS.diffChars) }] })
      ).success
    ).toBe(true);
  });

  test("a diff that is not text fails the call rather than silently disappearing", () => {
    expect(
      CodeDiffBlockSchema.safeParse(valid({ files: [{ path: "a.ts", diff: 12 }] })).success
    ).toBe(false);
  });

  test("decorative and soft fields degrade instead of failing the call", () => {
    const parsed = CodeDiffBlockSchema.safeParse({
      type: "code-diff",
      version: 1,
      title: 42,
      summary: "s".repeat(5000),
      moreFiles: "lots",
      files: [
        {
          path: "a.ts",
          oldPath: 7,
          status: "weird",
          added: "many",
          removed: -3,
          note: "n".repeat(900),
          annotations: [
            { text: "good", line: "twelve", side: "sideways", kind: "loud", match: 4 },
            { line: 3 },
            "not an object",
            { text: "x".repeat(2000) },
          ],
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const { data } = parsed;
    const file = data.files[0]!;

    expect(data.title).toBeUndefined();
    expect(data.moreFiles).toBeUndefined();
    expect(data.summary?.length).toBe(CODE_DIFF_LIMITS.summary);
    expect(file.oldPath).toBeUndefined();
    expect(file.status).toBeUndefined();
    expect(file.added).toBeUndefined();
    expect(file.removed).toBeUndefined();
    expect(file.note?.length).toBe(CODE_DIFF_LIMITS.note);
    // The first comment keeps its text and loses only the bad decoration.
    expect(file.annotations?.[0]).toMatchObject({ text: "good" });
    expect(file.annotations?.[0]?.line).toBeUndefined();
    expect(file.annotations?.[0]?.kind).toBeUndefined();
    // Unusable comments become empty text, which resolving the file drops.
    expect(file.annotations?.map((a) => a.text.length === 0)).toEqual([false, true, true, false]);
  });

  test("a file must name itself: the path is the one required field, and it is shortened not rejected", () => {
    expect(CodeDiffBlockSchema.safeParse(valid({ files: [{ diff: "@@\n-a\n+b" }] })).success).toBe(false);
    expect(CodeDiffBlockSchema.safeParse(valid({ files: [{ path: "" }] })).success).toBe(false);

    const long = CodeDiffBlockSchema.safeParse(valid({ files: [{ path: "p/".repeat(400) }] }));

    expect(long.success).toBe(true);
    if (long.success) expect(long.data.files[0]!.path.length).toBe(CODE_DIFF_LIMITS.path);
  });

  test("safeParseGenUIBlock accepts a fixture cleanly and tolerates a stored block with bad decoration", () => {
    const clean = safeParseGenUIBlock(FIXTURE_CODE_DIFF);

    expect(clean.ok && clean.hadPartialFailures).toBe(false);

    const stored = safeParseGenUIBlock(valid({ title: { nope: true } }));

    expect(stored.ok).toBe(true);
    expect(safeParseGenUIBlock({ type: "code-diff", version: 1, files: "no" }).ok).toBe(false);
  });
});

describe("what reaches the model", () => {
  // The AI SDK turns the tool's zod schema into JSON Schema exactly like this (provider-utils
  // zod4Schema); a description lost on the way is a field the model gets no guidance for.
  const json = z.toJSONSchema(CodeDiffBlockSchema, {
    target: "draft-7",
    io: "input",
    reused: "inline",
  }) as Record<string, unknown>;

  type Node = {
    type?: string;
    description?: string;
    properties?: Record<string, Node>;
    items?: Node;
    anyOf?: Node[];
  };

  function undescribed(node: Node, path: string): string[] {
    const missing: string[] = [];

    for (const [name, child] of Object.entries(node.properties ?? {})) {
      if (name === "type" || name === "version") continue;
      const here = `${path}.${name}`;

      if (!child.description) missing.push(here);
      if (child.items) missing.push(...undescribed(child.items, `${here}[]`));
      for (const option of child.anyOf ?? []) missing.push(...undescribed(option, here));
      missing.push(...undescribed(child, here));
    }

    return missing;
  }

  test("every field at every level carries a description", () => {
    expect(undescribed(json as Node, "block")).toEqual([]);
  });

  test("the descriptions state the format, the limits and what to do when unsure", () => {
    const properties = (json as Node).properties!;
    const file = properties.files!.items!.properties!;
    const annotation = file.annotations!.items!.properties!;

    expect(file.diff!.description).toContain("git diff");
    expect(file.diff!.description).toContain(String(CODE_DIFF_LIMITS.diffChars));
    expect(file.diff!.description).toContain("bare '@@'");
    expect(file.diff!.description).toContain("secrets");
    expect(properties.files!.description).toContain(String(CODE_DIFF_LIMITS.files));
    expect(annotation.match!.description).toContain("not certain");
    expect(annotation.line!.description).toContain("Omit it unless you are sure");
    expect(file.status!.description).toContain("Normally leave out");
  });

  test("required is the minimum: files, each file's path, each comment's text", () => {
    const node = json as Node & { required?: string[] };
    const file = node.properties!.files!.items as Node & { required?: string[] };
    const annotation = file.properties!.annotations!.items as Node & { required?: string[] };

    expect(node.required).toEqual(expect.arrayContaining(["type", "version", "files"]));
    expect(node.required).not.toContain("title");
    expect(file.required).toEqual(["path"]);
    expect(annotation.required).toEqual(["text"]);
  });

  test("the prompt teaches the contract and no longer forbids code in structured blocks", () => {
    expect(GEN_UI_TOOL_INSTRUCTIONS).toContain("code-diff");
    expect(GEN_UI_TOOL_INSTRUCTIONS).toContain("unified diff");
    expect(GEN_UI_TOOL_INSTRUCTIONS).toContain("changes to existing code");
    expect(GEN_UI_TOOL_INSTRUCTIONS).not.toContain("code-only responses, follow-up");
  });
});

describe("titles and markdown export", () => {
  test("the registry title falls back to the first path, then to a generic name", () => {
    expect(getGenUIBlockTitle(FIXTURE_CODE_DIFF)).toBe("Retry web search on rate limits");

    const untitled: CodeDiffBlock = { type: "code-diff", version: 1, files: [{ path: "a.ts" }] };

    expect(getGenUIBlockTitle(untitled)).toBe("a.ts");
    expect(codeDiffTitle({ files: [{ path: "a.ts" }, { path: "b.ts" }, { path: "c.ts" }] })).toBe(
      "Changes to a.ts and 2 more"
    );
    expect(codeDiffTitle({ files: [] })).toBe("Code changes");
  });

  test("markdown has the title, counted stats, a diff fence per file, and the comments", () => {
    const md = genUIBlockToMarkdown(FIXTURE_CODE_DIFF);

    expect(md).toContain("## Retry web search on rate limits");
    expect(md).toContain("3 files changed, +27 −3");
    expect(md).toContain("### `lib/exa/client.ts` — Modified (+10 −3)");
    expect(md).toContain("### `lib/exa/retry.ts` — Added (+16 −0)");
    expect(md).toContain("```diff\n@@ -38,9 +38,16 @@");
    expect(md).toContain("suggestion (near `isRateLimit(error)`): Only 429 is retried.");

    const review = genUIBlockToMarkdown(FIXTURE_CODE_DIFF_REVIEW);

    expect(review).toContain("note (line 42): Default raised from 1 to 3 attempts.");
    expect(review).toContain("note (line 42 (old)): The old default never retried.");
  });

  test("a diff containing backticks cannot close its own fence, and paths cannot break out", () => {
    const block: CodeDiffBlock = {
      type: "code-diff",
      version: 1,
      title: "t",
      files: [
        {
          path: "we`ird``path.ts",
          diff: "@@ -1 +1 @@\n-a\n+```\n+````js\n+`",
        },
      ],
    };
    const md = genUIBlockToMarkdown(block);
    const fence = md.match(/^(`{3,})diff$/m)?.[1];

    expect(fence).toBeDefined();
    expect(fence!.length).toBeGreaterThanOrEqual(5);
    // The closing fence is the same run, on its own line, after the content.
    expect(md).toContain(`\n${fence}\n`.slice(0, -1));
    // Three-backtick path text needs a longer span than the run inside it.
    expect(md).toContain("### ```we`ird``path.ts```");
  });

  test("rename and omitted-diff files read sensibly in markdown, and the loose form never throws", () => {
    const md = genUIBlockToMarkdown({
      type: "code-diff",
      version: 1,
      moreFiles: 5,
      files: [
        { path: "new/b.ts", oldPath: "old/b.ts", status: "renamed" },
        { path: "bun.lock", added: 10, removed: 4, note: "Regenerated." },
      ],
    });

    expect(md).toContain("`new/b.ts` — Renamed from `old/b.ts`");
    expect(md).toContain("`bun.lock` — Modified (+10 −4)");
    expect(md).toContain("2 files changed, +10 −4 (5 more not shown)");
    expect(md).not.toContain("```diff");
    expect(genUIBlockToMarkdownLoose({ type: "code-diff", title: "Hello" })).toContain("## Hello");
    expect(genUIBlockToMarkdownLoose({ type: "code-diff" })).toContain("Code changes");
  });
});
