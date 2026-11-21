import { describe, expect, test } from "bun:test";

import { GEN_UI_BLOCK_TYPES } from "@/lib/schemas/gen-ui/shared";
import {
  extractGenUiToolInstruction,
  modelInstructionMarkdownForBlock,
} from "@/lib/sandbox/gen-ui-lab-instructions";

describe("Gen UI Lab model instructions", () => {
  test("every block type gets markdown with its type id", () => {
    for (const type of GEN_UI_BLOCK_TYPES) {
      const md = modelInstructionMarkdownForBlock(type);

      expect(md).toContain(`\`${type}\``);
      expect(md).toContain("## Model instructions");
    }
  });

  test("extracts Arcadia tip for measure and hyp-graph", () => {
    expect(extractGenUiToolInstruction("measure")).toContain("shared numeric scale");
    expect(extractGenUiToolInstruction("hyp-graph")).toContain("causal");
    expect(extractGenUiToolInstruction("preview-blob")).toContain("previewURL");
  });

  test("research-report falls back without a dedicated tip", () => {
    expect(extractGenUiToolInstruction("research-report")).toBeNull();
    expect(modelInstructionMarkdownForBlock("research-report")).toContain("research_publish");
  });
});
