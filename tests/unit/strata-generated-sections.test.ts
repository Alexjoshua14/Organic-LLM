import { describe, expect, test } from "bun:test";

import {
  buildGeneratedSectionUpserts,
  isGeneratedSectionMissing,
} from "@/lib/strata/section-utils";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

const existingSections: StrataPageWithSections["sections"] = {
  raw_text: { key: "raw_text", content: "raw", contentJson: null },
  refined_text: { key: "refined_text", content: "old refined", contentJson: null },
  elaborated: { key: "elaborated", content: "existing elaborated", contentJson: null },
  design_instructions: { key: "design_instructions", content: "design", contentJson: null },
  ai_instructions: { key: "ai_instructions", content: "ai", contentJson: null },
};

describe("buildGeneratedSectionUpserts", () => {
  test("always includes refined_text update", () => {
    const updates = buildGeneratedSectionUpserts({
      existing: existingSections,
      refinedTitle: "Generated Refined Title",
      refinedText: "new refined",
      elaborated: "new elaborated",
    });

    expect(updates.some((u) => u.sectionKey === "refined_text")).toBe(true);
  });

  test("does not overwrite existing elaborated by default", () => {
    const updates = buildGeneratedSectionUpserts({
      existing: existingSections,
      refinedTitle: "Generated Refined Title",
      refinedText: "new refined",
      elaborated: "new elaborated",
      overwriteElaborated: false,
    });

    expect(updates.some((u) => u.sectionKey === "elaborated")).toBe(false);
  });

  test("overwrites elaborated when explicit overwrite is true", () => {
    const updates = buildGeneratedSectionUpserts({
      existing: existingSections,
      refinedTitle: "Generated Refined Title",
      refinedText: "new refined",
      elaborated: "new elaborated",
      overwriteElaborated: true,
    });

    const elaborated = updates.find((u) => u.sectionKey === "elaborated");
    expect(elaborated?.content).toBe("new elaborated");
  });

  test("fills elaborated when missing", () => {
    const updates = buildGeneratedSectionUpserts({
      existing: {
        ...existingSections,
        elaborated: { key: "elaborated", content: "   ", contentJson: null },
      },
      refinedTitle: "Generated Refined Title",
      refinedText: "new refined",
      elaborated: "new elaborated",
    });

    expect(updates.some((u) => u.sectionKey === "elaborated")).toBe(true);
  });

  test("stores generated refined title in refined content metadata", () => {
    const updates = buildGeneratedSectionUpserts({
      existing: existingSections,
      refinedTitle: "A Better Refined Heading",
      refinedText: "new refined",
      elaborated: "new elaborated",
    });

    const refined = updates.find((u) => u.sectionKey === "refined_text");
    expect(refined?.contentJson).toMatchObject({ generatedTitle: "A Better Refined Heading" });
  });
});

describe("isGeneratedSectionMissing", () => {
  test("treats null and blank content as missing", () => {
    expect(isGeneratedSectionMissing(null)).toBe(true);
    expect(isGeneratedSectionMissing({ key: "elaborated", content: "", contentJson: null })).toBe(
      true
    );
    expect(
      isGeneratedSectionMissing({ key: "elaborated", content: "   ", contentJson: null })
    ).toBe(true);
  });

  test("treats non-empty content as present", () => {
    expect(
      isGeneratedSectionMissing({ key: "elaborated", content: "present", contentJson: null })
    ).toBe(false);
  });
});
