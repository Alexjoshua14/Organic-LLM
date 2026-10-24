import { describe, expect, test } from "bun:test";

import { createRenderGenUiTool } from "@/lib/llm/gen-ui-tool";
import { FIXTURE_ANSWER_CARD, FIXTURE_DECISION_MATRIX } from "@/lib/schemas/gen-ui/fixtures";

describe("createRenderGenUiTool", () => {
  test("returns { block } shape", async () => {
    const t = createRenderGenUiTool();
    const result = await t.execute!(
      { block: FIXTURE_ANSWER_CARD },
      {
        toolCallId: "tc1",
        messages: [],
      }
    );
    expect(result).toEqual({ block: FIXTURE_ANSWER_CARD });
  });

  test("second call in same turn returns first block (max one per turn)", async () => {
    const t = createRenderGenUiTool();
    const first = await t.execute!(
      { block: FIXTURE_ANSWER_CARD },
      { toolCallId: "tc3", messages: [] }
    );
    const second = await t.execute!(
      { block: FIXTURE_DECISION_MATRIX },
      { toolCallId: "tc4", messages: [] }
    );
    expect(second).toEqual(first);
    expect(second.block.type).toBe("answer-card");
  });
});
