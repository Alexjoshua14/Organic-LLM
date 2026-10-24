import { describe, expect, test } from "bun:test";

import {
  GenUIBlockSchema,
  safeParseGenUIBlock,
  genUIBlockToMarkdown,
} from "@/lib/schemas/gen-ui";
import {
  FIXTURE_ANSWER_CARD,
  FIXTURE_DECISION_MATRIX,
  FIXTURE_INVALID_BLOCK,
} from "@/lib/schemas/gen-ui/fixtures";

describe("GenUIBlockSchema", () => {
  test("valid fixtures pass strict parse", () => {
    expect(GenUIBlockSchema.safeParse(FIXTURE_ANSWER_CARD).success).toBe(true);
    expect(GenUIBlockSchema.safeParse(FIXTURE_DECISION_MATRIX).success).toBe(true);
  });

  test("rejects too many key points", () => {
    const bad = {
      ...FIXTURE_ANSWER_CARD,
      keyPoints: Array.from({ length: 8 }, (_, i) => `point ${i}`),
    };
    expect(GenUIBlockSchema.safeParse(bad).success).toBe(false);
  });

  test("safeParse returns ok for valid block", () => {
    const r = safeParseGenUIBlock(FIXTURE_ANSWER_CARD);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hadPartialFailures).toBe(false);
      expect(r.block.type).toBe("answer-card");
    }
  });

  test("safeParse falls back on invalid version", () => {
    const r = safeParseGenUIBlock(FIXTURE_INVALID_BLOCK);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toBeDefined();
    }
  });

  test("cell note z.catch allows matrix with bad note types", () => {
    const raw = {
      ...FIXTURE_DECISION_MATRIX,
      scores: {
        ...FIXTURE_DECISION_MATRIX.scores,
        pg: {
          ...FIXTURE_DECISION_MATRIX.scores.pg,
          ops: { value: 4, note: 999 },
        },
      },
    };
    const r = safeParseGenUIBlock(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.block.type).toBe("decision-matrix");
      const note = r.block.scores.pg?.ops?.note;
      expect(note === undefined || typeof note === "string").toBe(true);
    }
  });

  test("toMarkdown includes title", () => {
    const md = genUIBlockToMarkdown(FIXTURE_ANSWER_CARD);
    expect(md).toContain(FIXTURE_ANSWER_CARD.title);
    expect(md).toContain("TL;DR");
  });
});
