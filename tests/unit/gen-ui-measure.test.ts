import { describe, expect, test } from "bun:test";

import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import {
  GEN_UI_BLOCK_TYPES,
  GenUIBlockSchema,
  genUIBlockToMarkdown,
  MeasureBlockSchema,
  safeParseGenUIBlock,
} from "@/lib/schemas/gen-ui";
import { FIXTURE_MEASURE } from "@/lib/schemas/gen-ui/fixtures";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";
import { makeTicks, toPct } from "@/components/chat/gen-ui/measure/measure-math";

describe("measure block", () => {
  test("is registered and listed among block types", () => {
    expect(GEN_UI_BLOCK_TYPES).toContain("measure");
    expect(GEN_UI_REGISTRY.measure.label).toBe("Measure");
    expect(GEN_UI_REGISTRY.measure.schema).toBe(MeasureBlockSchema);
  });

  test("fixture passes strict parse", () => {
    const r = GenUIBlockSchema.safeParse(FIXTURE_MEASURE);

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.type).toBe("measure");
      expect(r.data.rows).toHaveLength(5);
    }
  });

  test("rejects empty rows and inverted domain", () => {
    expect(
      MeasureBlockSchema.safeParse({
        ...FIXTURE_MEASURE,
        rows: [],
      }).success
    ).toBe(false);

    expect(
      MeasureBlockSchema.safeParse({
        ...FIXTURE_MEASURE,
        domain: { min: 10, max: 10 },
      }).success
    ).toBe(false);
  });

  test("requires value or range on each row", () => {
    expect(
      MeasureBlockSchema.safeParse({
        ...FIXTURE_MEASURE,
        rows: [{ id: "x", label: "X" }],
      }).success
    ).toBe(false);
  });

  test("defaults tone and unit", () => {
    const r = MeasureBlockSchema.safeParse({
      type: "measure",
      version: 1,
      title: "Scores",
      domain: { min: 0, max: 10 },
      rows: [{ id: "a", label: "A", value: 4 }],
    });

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.unit).toBe("");
      expect(r.data.rows[0]?.tone).toBe("accent");
    }
  });

  test("toMarkdown includes title and row values", () => {
    const md = genUIBlockToMarkdown(FIXTURE_MEASURE);

    expect(md).toContain("Share of world population");
    expect(md).toContain("Rome, 117 CE");
    expect(md).toContain("20–25%");
    expect(md).toContain("India");
  });

  test("safeParse accepts fixture", () => {
    const r = safeParseGenUIBlock(FIXTURE_MEASURE);

    expect(r.ok).toBe(true);
  });

  test("tool instructions mention measure", () => {
    expect(GEN_UI_TOOL_INSTRUCTIONS).toContain("measure");
  });

  test("toPct clamps to the domain", () => {
    const domain = { min: 0, max: 100 };

    expect(toPct(50, domain)).toBe(50);
    expect(toPct(-10, domain)).toBe(0);
    expect(toPct(150, domain)).toBe(100);
  });

  test("makeTicks defaults to five even steps", () => {
    expect(makeTicks({ min: 0, max: 100 })).toEqual([0, 25, 50, 75, 100]);
  });
});
