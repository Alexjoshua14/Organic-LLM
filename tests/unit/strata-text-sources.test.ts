import { describe, expect, test } from "bun:test";

import { StrataTextSourceNodeSchema } from "@/lib/schemas/strata";
import {
  buildCorpusFromTextSources,
  parseTextSourcesFromContentJson,
  setTextSourcesInContentJson,
} from "@/lib/strata/text-sources";

describe("text source corpus", () => {
  test("buildCorpusFromTextSources includes titles and kinds", () => {
    const nodes = [
      StrataTextSourceNodeSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        kind: "user_text",
        title: "Note A",
        body: "alpha",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      StrataTextSourceNodeSchema.parse({
        id: "00000000-0000-4000-8000-000000000002",
        kind: "url",
        title: "Article",
        body: "beta",
        createdAt: "2026-01-01T00:00:00.000Z",
        meta: { url: "https://example.com/x" },
      }),
    ];
    const corpus = buildCorpusFromTextSources(nodes);
    expect(corpus).toContain("Source 1: Note A [user_text]");
    expect(corpus).toContain("alpha");
    expect(corpus).toContain("Source 2: Article [url]");
    expect(corpus).toContain("beta");
  });

  test("parseTextSourcesFromContentJson ignores invalid entries", () => {
    const parsed = parseTextSourcesFromContentJson({
      textSources: [{ bad: true }, { id: "not-a-uuid", kind: "user_text", title: "x", body: "y", createdAt: "t" }],
    });
    expect(parsed.length).toBe(0);
  });

  test("setTextSourcesInContentJson preserves generationContext", () => {
    const merged = setTextSourcesInContentJson(
      { generationContext: { lastGeneratedRawText: "a", lastGeneratedAt: "t", lastGenerationMode: "create" } },
      [
        StrataTextSourceNodeSchema.parse({
          id: "00000000-0000-4000-8000-000000000003",
          kind: "clipboard",
          title: "C",
          body: "body",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      ]
    );
    expect(merged.generationContext).toEqual({
      lastGeneratedRawText: "a",
      lastGeneratedAt: "t",
      lastGenerationMode: "create",
    });
    expect(Array.isArray(merged.textSources)).toBe(true);
  });
});
