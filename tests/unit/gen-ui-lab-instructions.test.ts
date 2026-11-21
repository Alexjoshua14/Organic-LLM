import { describe, expect, test } from "bun:test";

import { GEN_UI_BLOCK_TYPES } from "@/lib/schemas/gen-ui/shared";
import {
  extractGenUiToolInstruction,
  instructionDocForArchetype,
  modelInstructionDocForBlock,
  modelInstructionMarkdownForBlock,
} from "@/lib/sandbox/gen-ui-lab-instructions";

describe("Gen UI Lab model instructions", () => {
  test("every block type gets a structured doc with collapsible sections", () => {
    for (const type of GEN_UI_BLOCK_TYPES) {
      const doc = modelInstructionDocForBlock(type);

      expect(doc.typeId).toBe(type);
      expect(doc.eyebrow).toContain("Model instructions");
      expect(doc.sections.length).toBeGreaterThanOrEqual(2);
      expect(doc.sections.some((s) => s.id === "model" && s.defaultOpen)).toBe(true);
      expect(doc.sections.some((s) => s.id === "shared")).toBe(true);
    }
  });

  test("markdown form still includes the type id", () => {
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
    expect(modelInstructionDocForBlock("research-report").sections[0]!.body).toContain(
      "research_publish"
    );
  });

  test("instructionDocForArchetype covers diagram and blocks", () => {
    expect(instructionDocForArchetype("mermaid-diagram")?.title).toBe("Diagram");
    expect(instructionDocForArchetype("measure")?.title).toBe("Measure");
    expect(instructionDocForArchetype("not-a-type")).toBeNull();
  });
});
