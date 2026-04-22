import { describe, expect, test } from "bun:test";

import {
  ELEVENLABS_V3_SPEECH_MODEL_ID,
  isElevenLabsV3SpeechModelId,
} from "@/lib/tts/elevenlabs-v3-speech";

describe("isElevenLabsV3SpeechModelId", () => {
  test("is true only for eleven_v3", () => {
    expect(isElevenLabsV3SpeechModelId(ELEVENLABS_V3_SPEECH_MODEL_ID)).toBe(true);
    expect(isElevenLabsV3SpeechModelId("eleven_flash_v2_5")).toBe(false);
    expect(isElevenLabsV3SpeechModelId(undefined)).toBe(false);
  });
});
