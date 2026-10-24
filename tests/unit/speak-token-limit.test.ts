import { describe, expect, it } from "bun:test";

import { chunkTextForSpeak } from "@/lib/speak/chunk-text";
import {
  estimateSpeakTokens,
  SPEAK_MAX_INPUT_TOKENS,
  validateSpeakInput,
} from "@/lib/speak/token-limit";

describe("speak token limits", () => {
  it("estimates tokens from character length", () => {
    expect(estimateSpeakTokens("hello world")).toBe(3);
  });

  it("accepts text within 10k token budget", () => {
    const text = "a".repeat(SPEAK_MAX_INPUT_TOKENS * 4);

    expect(validateSpeakInput(text).ok).toBe(true);
  });

  it("rejects text over 10k token budget", () => {
    const text = "a".repeat(SPEAK_MAX_INPUT_TOKENS * 4 + 1);
    const result = validateSpeakInput(text);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("10,000");
    }
  });
});

describe("chunkTextForSpeak", () => {
  it("returns single chunk for short text", () => {
    expect(chunkTextForSpeak("Short paragraph.")).toEqual(["Short paragraph."]);
  });

  it("splits long text into multiple chunks", () => {
    const paragraph = "word ".repeat(900).trim();
    const text = `${paragraph}\n\n${paragraph}`;

    const chunks = chunkTextForSpeak(text, 1000);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ").length).toBeGreaterThan(1000);
  });
});
