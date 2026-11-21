import { describe, expect, test } from "bun:test";

import { GenUIBlockSchema } from "@/lib/schemas/gen-ui";
import { GEN_UI_BLOCK_TYPES } from "@/lib/schemas/gen-ui/shared";
import {
  catalogShowcases,
  everyShowcaseBlock,
  GEN_UI_LAB_SHOWCASE_TYPES,
  isGenUiShowcaseType,
  showcasePresetsFor,
} from "@/lib/sandbox/gen-ui-lab-showcases";
import { buildDefaultBlockMap } from "@/lib/sandbox/gen-ui-lab";

describe("Gen UI Lab showcases", () => {
  test("every showcase archetype has at least two states (except when catalog says otherwise)", () => {
    for (const type of GEN_UI_LAB_SHOWCASE_TYPES) {
      const catalog = catalogShowcases(type);

      expect(catalog.length).toBeGreaterThanOrEqual(2);
      expect(new Set(catalog.map((p) => p.id)).size).toBe(catalog.length);
    }
  });

  test("every showcase block parses", () => {
    for (const block of everyShowcaseBlock()) {
      const result = GenUIBlockSchema.safeParse(block);

      expect(result.success, `${block.type} failed: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  test("live block replaces the lead preset without dropping the rest", () => {
    const map = buildDefaultBlockMap();
    const live = {
      ...map.measure,
      title: "Generated measure",
    };
    const presets = showcasePresetsFor("measure", live);

    expect(presets[0]?.block).toEqual(live);
    expect(presets.length).toBe(catalogShowcases("measure").length);
    expect(presets.slice(1).map((p) => p.id)).toEqual(
      catalogShowcases("measure")
        .slice(1)
        .map((p) => p.id)
    );
  });

  test("decision-matrix and code-diff stay on their dedicated demos", () => {
    expect(isGenUiShowcaseType("decision-matrix")).toBe(false);
    expect(isGenUiShowcaseType("code-diff")).toBe(false);
    for (const type of GEN_UI_BLOCK_TYPES) {
      if (type === "decision-matrix" || type === "code-diff") continue;
      expect(isGenUiShowcaseType(type)).toBe(true);
    }
  });
});
