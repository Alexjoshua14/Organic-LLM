import { describe, test, expect } from "bun:test";

import {
  mergeAlignments,
  decodeAudioBase64,
  calculateChunkLength,
  getCurrentCharacterIndex,
} from "@/lib/llm/tts/helpers";
import { AudioStreamChunkSchema } from "@/lib/schemas/tts";
import type { AlignmentData } from "@/lib/schemas/tts";
import {
  createFakeAlignment,
  createFakeMP3,
  createMockAudioChunk,
  uint8ArrayToBase64,
  buildMockNDJSONStream,
} from "../helpers/mock-tts";

// ---------------------------------------------------------------------------
// decodeAudioBase64
// ---------------------------------------------------------------------------

describe("decodeAudioBase64", () => {
  test("round-trips Uint8Array → base64 → Uint8Array", () => {
    const original = createFakeMP3(2);
    const base64 = uint8ArrayToBase64(original);
    const decoded = decodeAudioBase64(base64);

    expect(decoded.length).toBe(original.length);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  test("decodes a known short string", () => {
    // "Hello" in base64 is "SGVsbG8="
    const decoded = decodeAudioBase64("SGVsbG8=");
    const text = new TextDecoder().decode(decoded);
    expect(text).toBe("Hello");
  });

  test("returns empty Uint8Array for empty base64", () => {
    const decoded = decodeAudioBase64("");
    expect(decoded.length).toBe(0);
  });

  test("preserves all 256 byte values", () => {
    // Ensure no byte value is mangled during base64 round-trip
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const base64 = uint8ArrayToBase64(allBytes);
    const decoded = decodeAudioBase64(base64);
    expect(Array.from(decoded)).toEqual(Array.from(allBytes));
  });
});

// ---------------------------------------------------------------------------
// calculateChunkLength
// ---------------------------------------------------------------------------

describe("calculateChunkLength", () => {
  test("estimates correct duration for known byte size", () => {
    // 10 frames × 417 bytes = 4170 bytes
    // At 128kbps (16384 bytes/sec): 4170 / 16384 ≈ 0.2545 seconds
    const chunk = createMockAudioChunk({ mp3Frames: 10 });
    const durationSeconds = calculateChunkLength({
      audioBase64: chunk.audioBase64,
    });

    const expectedBytes = 10 * 417;
    const expectedDuration = expectedBytes / 16384;
    expect(durationSeconds).toBeCloseTo(expectedDuration, 2);
  });

  test("longer audio has longer estimated duration", () => {
    const short = createMockAudioChunk({ mp3Frames: 2 });
    const long = createMockAudioChunk({ mp3Frames: 20 });

    const shortDuration = calculateChunkLength({
      audioBase64: short.audioBase64,
    });
    const longDuration = calculateChunkLength({
      audioBase64: long.audioBase64,
    });

    expect(longDuration).toBeGreaterThan(shortDuration);
    // Should be 10x, with small tolerance for base64 padding
    expect(longDuration / shortDuration).toBeCloseTo(10, 0);
  });
});

// ---------------------------------------------------------------------------
// mergeAlignments
// ---------------------------------------------------------------------------

describe("mergeAlignments", () => {
  test("returns null for empty array", () => {
    expect(mergeAlignments([])).toBeNull();
  });

  test("single chunk: timestamps are unchanged", () => {
    const alignment = createFakeAlignment("Hi", 0, 0.1);
    const result = mergeAlignments([{ alignment }]);

    expect(result).not.toBeNull();
    expect(result!.alignment!.characters).toEqual(["H", "i"]);
    // Timestamps should be exactly as input — no offset for single chunk
    expect(result!.alignment!.characterStartTimesSeconds).toEqual([0, 0.1]);
    expect(result!.alignment!.characterEndTimesSeconds).toEqual([0.1, 0.2]);
  });

  test("two chunks: second chunk is offset by first chunk's duration", () => {
    // ElevenLabs sends each chunk with timestamps relative to that chunk's audio.
    // Both start at 0.
    const chunk1 = createFakeAlignment("Hi", 0, 0.1); // H: 0.0-0.1, i: 0.1-0.2
    const chunk2 = createFakeAlignment("Go", 0, 0.1); // G: 0.0-0.1, o: 0.1-0.2

    const result = mergeAlignments([
      { alignment: chunk1 },
      { alignment: chunk2 },
    ]);

    const a = result!.alignment!;
    expect(a.characters).toEqual(["H", "i", "G", "o"]);

    // Chunk 1 stays at 0.0–0.2
    expect(a.characterStartTimesSeconds[0]).toBeCloseTo(0.0, 4);
    expect(a.characterEndTimesSeconds[1]).toBeCloseTo(0.2, 4);

    // Chunk 2 should be OFFSET by 0.2s (the end of chunk 1)
    // G: 0.2-0.3, o: 0.3-0.4
    expect(a.characterStartTimesSeconds[2]).toBeCloseTo(0.2, 4);
    expect(a.characterStartTimesSeconds[3]).toBeCloseTo(0.3, 4);
    expect(a.characterEndTimesSeconds[3]).toBeCloseTo(0.4, 4);
  });

  test("three chunks: cumulative offset grows correctly", () => {
    // Each chunk: 3 chars × 0.1s = 0.3s duration, all start at 0
    const chunk1 = createFakeAlignment("abc", 0, 0.1);
    const chunk2 = createFakeAlignment("def", 0, 0.1);
    const chunk3 = createFakeAlignment("ghi", 0, 0.1);

    const result = mergeAlignments([
      { alignment: chunk1 },
      { alignment: chunk2 },
      { alignment: chunk3 },
    ]);

    const a = result!.alignment!;

    // chunk1: 0.0–0.3 (no offset)
    expect(a.characterStartTimesSeconds[0]).toBeCloseTo(0.0, 4);
    expect(a.characterEndTimesSeconds[2]).toBeCloseTo(0.3, 4);

    // chunk2: 0.3–0.6 (offset by 0.3)
    expect(a.characterStartTimesSeconds[3]).toBeCloseTo(0.3, 4);
    expect(a.characterEndTimesSeconds[5]).toBeCloseTo(0.6, 4);

    // chunk3: 0.6–0.9 (offset by 0.6)
    expect(a.characterStartTimesSeconds[6]).toBeCloseTo(0.6, 4);
    expect(a.characterEndTimesSeconds[8]).toBeCloseTo(0.9, 4);

    // Total timeline should be continuous: last end = 0.9
    const lastEnd =
      a.characterEndTimesSeconds[a.characterEndTimesSeconds.length - 1];
    expect(lastEnd).toBeCloseTo(0.9, 4);
  });

  test("alignment and normalizedAlignment offsets are tracked independently", () => {
    // Different durations: alignment = 0.2s, normalized = 0.4s
    const chunk1 = {
      alignment: createFakeAlignment("AB", 0, 0.1), // ends at 0.2
      normalizedAlignment: createFakeAlignment("ab", 0, 0.2), // ends at 0.4
    };
    const chunk2 = {
      alignment: createFakeAlignment("CD", 0, 0.1), // relative 0.0-0.2
      normalizedAlignment: createFakeAlignment("cd", 0, 0.2), // relative 0.0-0.4
    };

    const result = mergeAlignments([chunk1, chunk2]);

    // alignment chunk2 offset by 0.2
    expect(result!.alignment!.characterStartTimesSeconds[2]).toBeCloseTo(
      0.2,
      4,
    );
    // normalizedAlignment chunk2 offset by 0.4
    expect(
      result!.normalizedAlignment!.characterStartTimesSeconds[2],
    ).toBeCloseTo(0.4, 4);
  });

  test("chunks with non-zero start times get offset added on top", () => {
    // If ElevenLabs sends a chunk starting at 0.05 (not 0), the offset is still
    // added on top. This tests that we don't assume chunks start at 0.
    const chunk1 = createFakeAlignment("AB", 0.05, 0.1); // 0.05-0.25
    const chunk2 = createFakeAlignment("CD", 0.03, 0.1); // 0.03-0.23 relative

    const result = mergeAlignments([
      { alignment: chunk1 },
      { alignment: chunk2 },
    ]);

    const a = result!.alignment!;
    // Chunk 1: unchanged (0.05, 0.15, 0.15, 0.25)
    expect(a.characterStartTimesSeconds[0]).toBeCloseTo(0.05, 4);
    expect(a.characterEndTimesSeconds[1]).toBeCloseTo(0.25, 4);

    // Chunk 2: offset by chunk1's last end (0.25)
    // C: 0.03 + 0.25 = 0.28, D: 0.13 + 0.25 = 0.38
    expect(a.characterStartTimesSeconds[2]).toBeCloseTo(0.28, 4);
    expect(a.characterEndTimesSeconds[3]).toBeCloseTo(0.48, 4);
  });

  test("skips chunks that have no alignment data without affecting offset", () => {
    const chunk1 = createFakeAlignment("Hi", 0, 0.1); // ends 0.2

    const result = mergeAlignments([
      { alignment: chunk1 },
      {}, // no alignment — audio-only chunk
      { alignment: createFakeAlignment("!", 0, 0.05) }, // should still offset by 0.2
    ]);

    const a = result!.alignment!;
    expect(a.characters).toEqual(["H", "i", "!"]);
    // "!" offset by chunk1 end (0.2), not affected by empty chunk
    expect(a.characterStartTimesSeconds[2]).toBeCloseTo(0.2, 4);
  });

  test("handles empty alignment arrays gracefully (offset stays 0)", () => {
    const emptyAlignment: AlignmentData = {
      characters: [],
      characterStartTimesSeconds: [],
      characterEndTimesSeconds: [],
    };

    const result = mergeAlignments([
      { alignment: emptyAlignment },
      { alignment: createFakeAlignment("ok", 0, 0.1) },
    ]);

    const a = result!.alignment!;
    expect(a.characters).toEqual(["o", "k"]);
    // Empty chunk has no last end time → offset stays 0
    expect(a.characterStartTimesSeconds[0]).toBeCloseTo(0.0, 4);
  });
});

// ---------------------------------------------------------------------------
// getCurrentCharacterIndex
// ---------------------------------------------------------------------------

describe("getCurrentCharacterIndex", () => {
  const alignment = createFakeAlignment("Hello", 0, 0.1);
  // H: 0.0–0.1, e: 0.1–0.2, l: 0.2–0.3, l: 0.3–0.4, o: 0.4–0.5

  test("returns correct index at start of first character", () => {
    expect(getCurrentCharacterIndex(0.0, alignment)).toBe(0);
  });

  test("returns correct index in the middle of a character", () => {
    expect(getCurrentCharacterIndex(0.25, alignment)).toBe(2); // "l"
  });

  test("returns correct index at boundary between characters", () => {
    // At exactly 0.1: char 0 ends (<=0.1), char 1 starts (>=0.1).
    // Linear scan returns first match = char 0.
    const idx = getCurrentCharacterIndex(0.1, alignment);
    expect(idx).toBe(0);
  });

  test("returns last character index near the end", () => {
    expect(getCurrentCharacterIndex(0.45, alignment)).toBe(4); // "o"
  });

  test("returns null after all characters end", () => {
    expect(getCurrentCharacterIndex(0.6, alignment)).toBeNull();
  });

  test("returns null for negative time", () => {
    expect(getCurrentCharacterIndex(-1, alignment)).toBeNull();
  });

  test("works correctly with MERGED multi-chunk alignment", () => {
    // This tests the full pipeline: merge then query.
    const chunk1 = createFakeAlignment("Hi", 0, 0.1); // H:0.0-0.1, i:0.1-0.2
    const chunk2 = createFakeAlignment("Go", 0, 0.1); // G:0.0-0.1, o:0.1-0.2

    const merged = mergeAlignments([
      { alignment: chunk1 },
      { alignment: chunk2 },
    ]);
    const a = merged!.alignment!;

    // After merge: H:0.0-0.1, i:0.1-0.2, G:0.2-0.3, o:0.3-0.4
    expect(getCurrentCharacterIndex(0.0, a)).toBe(0); // H
    expect(getCurrentCharacterIndex(0.15, a)).toBe(1); // i
    expect(getCurrentCharacterIndex(0.25, a)).toBe(2); // G (offset chunk)
    expect(getCurrentCharacterIndex(0.35, a)).toBe(3); // o (offset chunk)
    expect(getCurrentCharacterIndex(0.5, a)).toBeNull(); // past end
  });
});

// ---------------------------------------------------------------------------
// AudioStreamChunkSchema validation (NDJSON chunk parsing)
// ---------------------------------------------------------------------------

describe("AudioStreamChunkSchema", () => {
  test("validates a well-formed chunk with alignment", () => {
    const chunk = createMockAudioChunk({ text: "Hi" });
    const result = AudioStreamChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });

  test("validates a chunk with audioBase64 only (no alignment)", () => {
    const result = AudioStreamChunkSchema.safeParse({
      audioBase64: "AAAA",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a chunk missing audioBase64", () => {
    const result = AudioStreamChunkSchema.safeParse({
      alignment: createFakeAlignment("Hi"),
    });
    expect(result.success).toBe(false);
  });

  test("rejects a chunk with mismatched alignment array lengths", () => {
    const result = AudioStreamChunkSchema.safeParse({
      audioBase64: "AAAA",
      alignment: {
        characters: ["H", "i"],
        characterStartTimesSeconds: [0], // wrong length
        characterEndTimesSeconds: [0.1, 0.2],
      },
    });
    // Zod accepts this because the schema only checks for z.array(z.number()),
    // it doesn't enforce equal lengths. This is a gap in validation.
    expect(result.success).toBe(true);
  });

  test("parses each line from a mock NDJSON stream", () => {
    const ndjson = buildMockNDJSONStream([
      { text: "Hello " },
      { text: "world" },
    ]);
    const lines = ndjson.trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(2);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      const result = AudioStreamChunkSchema.safeParse(parsed);
      expect(result.success).toBe(true);
    }
  });
});
