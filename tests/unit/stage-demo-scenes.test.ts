import { expect, test } from "bun:test";

import { STAGE_DEMO_SCENES, stageDemoScene, stageDemoState } from "@/lib/stage/demo/scenes";
import { validateStageLayout, stageReservedRects } from "@/lib/stage/layout";
import { emptyStageState, StageStateSchema } from "@/lib/stage/schema";

test("every demo scene is a valid, collision-free Stage state", () => {
  for (const scene of STAGE_DEMO_SCENES) {
    const state = stageDemoState(emptyStageState(), scene, "hello");

    expect(StageStateSchema.safeParse(state).success).toBe(true);
    expect(() => validateStageLayout(state.widgets, stageReservedRects(state))).not.toThrow();
  }
});

test("scenes keep the running conversation", () => {
  const first = stageDemoState(emptyStageState(), stageDemoScene("brain-dump")!, "a");
  const second = stageDemoState(first, stageDemoScene("map-idea")!, "b");

  expect(second.messages.map((m) => m.text).slice(0, 2)).toEqual(["a", first.messages[1].text]);
  expect(second.revision).toBe(2);
});
