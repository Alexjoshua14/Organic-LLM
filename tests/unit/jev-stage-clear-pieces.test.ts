import { describe, expect, test } from "bun:test";

import { executeJevDirectTool } from "@/lib/jev-stage/direct-tools";
import { applyJevRespondEffects, emptyJevRespondEffects } from "@/lib/jev-stage/respond";
import { emptyStageState } from "@/lib/stage/schema";

const note = {
  id: "00000000-0000-4000-8000-000000000021",
  kind: "note" as const,
  title: "Temp",
  rect: { x: 8, y: 4, w: 11, h: 18 },
  text: "clear me",
};
const collection = {
  id: "00000000-0000-4000-8000-000000000022",
  kind: "collection" as const,
  title: "Ideas",
  rect: { x: 20, y: 4, w: 12, h: 18 },
  items: [],
};

describe("Jev Stage clear pieces", () => {
  test("direct clear_pieces keeps collections and drops notes", async () => {
    const state = { ...emptyStageState(), widgets: [note, collection] };
    const result = await executeJevDirectTool({
      ownerId: "owner",
      state,
      selected: {
        kind: "clear_pieces",
        confidence: 1,
        reason: "clear",
        args: {},
      },
      message: "clear the stage",
      requestId: "00000000-0000-4000-8000-000000000023",
    });

    expect(result.state.widgets).toEqual([expect.objectContaining({ kind: "collection" })]);
    expect(result.state.messages.at(-1)?.text).toContain("Cleared 1 piece");
  });

  test("Respond clear_stage_pieces effect clears generated pieces", () => {
    const effects = emptyJevRespondEffects();

    effects.clearPieces = true;
    const applied = applyJevRespondEffects({
      state: { ...emptyStageState(), widgets: [note, collection] },
      effects,
      requestId: "00000000-0000-4000-8000-000000000024",
    });

    expect(applied.state.widgets).toEqual([expect.objectContaining({ kind: "collection" })]);
  });
});
