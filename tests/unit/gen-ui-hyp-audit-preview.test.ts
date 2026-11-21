import { describe, expect, test } from "bun:test";

import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import {
  GEN_UI_BLOCK_TYPES,
  GenUIBlockSchema,
  genUIBlockToMarkdown,
  HypGraphBlockSchema,
  PreviewBlobBlockSchema,
  safeParseGenUIBlock,
} from "@/lib/schemas/gen-ui";
import {
  FIXTURE_HYP_GRAPH,
  FIXTURE_AUDIT_LINE,
  FIXTURE_PREVIEW_BLOB,
} from "@/lib/schemas/gen-ui/fixtures";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";
import { designerBlockShapes } from "@/lib/stage/block-shapes";

describe("hyp-graph, audit-line, preview-blob", () => {
  test("are registered", () => {
    expect(GEN_UI_BLOCK_TYPES).toContain("hyp-graph");
    expect(GEN_UI_BLOCK_TYPES).toContain("audit-line");
    expect(GEN_UI_BLOCK_TYPES).toContain("preview-blob");
    expect(GEN_UI_REGISTRY["hyp-graph"].label).toBe("Hypothesis");
    expect(GEN_UI_REGISTRY["audit-line"].label).toBe("Audit");
    expect(GEN_UI_REGISTRY["preview-blob"].label).toBe("Preview");
  });

  test("fixtures pass strict parse", () => {
    for (const fixture of [FIXTURE_HYP_GRAPH, FIXTURE_AUDIT_LINE, FIXTURE_PREVIEW_BLOB]) {
      expect(GenUIBlockSchema.safeParse(fixture).success).toBe(true);
      expect(safeParseGenUIBlock(fixture).ok).toBe(true);
    }
  });

  test("hyp-graph rejects unknown edge endpoints", () => {
    expect(
      HypGraphBlockSchema.safeParse({
        ...FIXTURE_HYP_GRAPH,
        edges: [{ from: "usage", to: "missing" }],
      }).success
    ).toBe(false);
  });

  test("preview-blob rejects non-http URLs", () => {
    expect(
      PreviewBlobBlockSchema.safeParse({
        type: "preview-blob",
        version: 1,
        title: "Bad",
        previewURL: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });

  test("toMarkdown and prompts mention the types", () => {
    expect(genUIBlockToMarkdown(FIXTURE_HYP_GRAPH)).toContain("Team plan");
    expect(genUIBlockToMarkdown(FIXTURE_AUDIT_LINE)).toContain("retrieve");
    expect(genUIBlockToMarkdown(FIXTURE_PREVIEW_BLOB)).toContain("placehold.co");
    const shapes = designerBlockShapes();

    for (const type of ["hyp-graph", "audit-line", "preview-blob"]) {
      expect(GEN_UI_TOOL_INSTRUCTIONS).toContain(type);
      expect(shapes).toContain(type);
    }
  });
});
