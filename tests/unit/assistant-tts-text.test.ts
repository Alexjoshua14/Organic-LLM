import { describe, expect, test } from "bun:test";

import { assistantTtsTextToPlay } from "@/lib/tts/assistant-tts-text";

describe("assistantTtsTextToPlay", () => {
  test("returns full text when ttsWholeMessage is true", () => {
    expect(assistantTtsTextToPlay("A\n\nB", true)).toBe("A\n\nB");
  });

  test("returns first paragraph when ttsWholeMessage is false", () => {
    expect(assistantTtsTextToPlay("First block\n\nSecond block", false)).toBe("First block");
  });
});
