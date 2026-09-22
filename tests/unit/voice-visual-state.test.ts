import { describe, expect, test } from "bun:test";

import {
  applyVoiceEffect,
  applyVoiceEffects,
  EMPTY_VOICE_VISUAL_STATE,
} from "@/lib/speak/voice-visual-state";

describe("applyVoiceEffect", () => {
  test("adds a gen-UI block the first time an instance appears", () => {
    const next = applyVoiceEffect(EMPTY_VOICE_VISUAL_STATE, {
      type: "gen_ui",
      instanceId: "a",
      block: { kind: "card" },
    });

    expect(next.genUiBlocks).toEqual([{ instanceId: "a", block: { kind: "card" }, remountKey: 0 }]);
  });

  test("re-rendering the same instance bumps its remount key rather than appending", () => {
    const once = applyVoiceEffect(EMPTY_VOICE_VISUAL_STATE, {
      type: "gen_ui",
      instanceId: "a",
      block: { v: 1 },
    });
    const twice = applyVoiceEffect(once, { type: "gen_ui", instanceId: "a", block: { v: 2 } });

    expect(twice.genUiBlocks).toHaveLength(1);
    expect(twice.genUiBlocks[0]!.remountKey).toBe(1);
    expect(twice.genUiBlocks[0]!.block).toEqual({ v: 2 });
  });

  test("refresh bumps only the targeted instance", () => {
    const state = applyVoiceEffects(EMPTY_VOICE_VISUAL_STATE, [
      { type: "gen_ui", instanceId: "a", block: {} },
      { type: "gen_ui", instanceId: "b", block: {} },
      { type: "refresh_component", instanceId: "b" },
    ]);

    expect(state.genUiBlocks.find((b) => b.instanceId === "a")!.remountKey).toBe(0);
    expect(state.genUiBlocks.find((b) => b.instanceId === "b")!.remountKey).toBe(1);
  });

  test("refreshing an unknown instance is a no-op, not a crash", () => {
    const state = applyVoiceEffect(EMPTY_VOICE_VISUAL_STATE, {
      type: "refresh_component",
      instanceId: "missing",
    });

    expect(state.genUiBlocks).toEqual([]);
  });

  test("ui state upserts merge by id within a surface", () => {
    const state = applyVoiceEffects(EMPTY_VOICE_VISUAL_STATE, [
      { type: "upsert_ui_state", surfaceId: "s", items: [{ id: "1", data: { n: 1 } }] },
      {
        type: "upsert_ui_state",
        surfaceId: "s",
        items: [
          { id: "1", data: { n: 2 } },
          { id: "2", data: { n: 3 } },
        ],
      },
    ]);

    expect(state.uiStateBySurface.s).toEqual([
      { id: "1", data: { n: 2 } },
      { id: "2", data: { n: 3 } },
    ]);
  });

  test("surfaces do not bleed into each other", () => {
    const state = applyVoiceEffects(EMPTY_VOICE_VISUAL_STATE, [
      { type: "upsert_ui_state", surfaceId: "a", items: [{ id: "1", data: {} }] },
      { type: "upsert_ui_state", surfaceId: "b", items: [{ id: "1", data: {} }] },
    ]);

    expect(Object.keys(state.uiStateBySurface).sort()).toEqual(["a", "b"]);
  });

  test("does not mutate the input state", () => {
    const before = structuredClone(EMPTY_VOICE_VISUAL_STATE);

    applyVoiceEffect(EMPTY_VOICE_VISUAL_STATE, { type: "display_text", text: "hi" });

    expect(EMPTY_VOICE_VISUAL_STATE).toEqual(before);
  });

  test("display text and web preview replace rather than accumulate", () => {
    const state = applyVoiceEffects(EMPTY_VOICE_VISUAL_STATE, [
      { type: "display_text", text: "first" },
      { type: "display_text", text: "second" },
      { type: "web_preview", url: "https://a.test" },
      { type: "web_preview", url: "https://b.test", title: "B" },
    ]);

    expect(state.displayText).toBe("second");
    expect(state.webPreview).toEqual({ url: "https://b.test", title: "B" });
  });
});
