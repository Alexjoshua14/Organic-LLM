import { describe, expect, test } from "bun:test";

import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import {
  GEN_UI_BLOCK_TYPES,
  GenUIBlockSchema,
  genUIBlockToMarkdown,
  ErgonBoardBlockSchema,
  ErgonProposalBlockSchema,
  safeParseGenUIBlock,
} from "@/lib/schemas/gen-ui";
import { FIXTURE_ERGON_BOARD, FIXTURE_ERGON_PROPOSAL } from "@/lib/schemas/gen-ui/fixtures";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";

describe("ergon gen-ui blocks", () => {
  test("are registered", () => {
    expect(GEN_UI_BLOCK_TYPES).toContain("ergon-board");
    expect(GEN_UI_BLOCK_TYPES).toContain("ergon-proposal");
    expect(GEN_UI_REGISTRY["ergon-board"].label).toBe("Ergon board");
    expect(GEN_UI_REGISTRY["ergon-proposal"].label).toBe("Ergon proposal");
  });

  test("fixtures pass strict parse", () => {
    expect(GenUIBlockSchema.safeParse(FIXTURE_ERGON_BOARD).success).toBe(true);
    expect(GenUIBlockSchema.safeParse(FIXTURE_ERGON_PROPOSAL).success).toBe(true);
  });

  test("rejects items whose stateType has no column", () => {
    expect(
      ErgonBoardBlockSchema.safeParse({
        ...FIXTURE_ERGON_BOARD,
        columns: [{ id: "ready", label: "Ready" }],
        items: [
          {
            id: "x",
            source: "todo",
            title: "X",
            state: "Done",
            stateType: "done",
            priority: "none",
          },
        ],
      }).success
    ).toBe(false);
  });

  test("proposal requires at least one change", () => {
    expect(
      ErgonProposalBlockSchema.safeParse({
        type: "ergon-proposal",
        version: 1,
        title: "Empty",
        source: "todo",
        changes: [],
      }).success
    ).toBe(false);
  });

  test("toMarkdown includes board title and proposal ops", () => {
    expect(genUIBlockToMarkdown(FIXTURE_ERGON_BOARD)).toContain("Ergon · Preview");
    expect(genUIBlockToMarkdown(FIXTURE_ERGON_PROPOSAL)).toContain("complete");
  });

  test("safeParse accepts fixtures", () => {
    expect(safeParseGenUIBlock(FIXTURE_ERGON_BOARD).ok).toBe(true);
    expect(safeParseGenUIBlock(FIXTURE_ERGON_PROPOSAL).ok).toBe(true);
  });

  test("tool instructions mention ergon blocks", () => {
    expect(GEN_UI_TOOL_INSTRUCTIONS).toContain("ergon-board");
    expect(GEN_UI_TOOL_INSTRUCTIONS).toContain("ergon-proposal");
  });
});
