import { describe, test, expect } from "bun:test";

import { createFakeMP3, uint8ArrayToRecord } from "../helpers/mock-tts";

// ---------------------------------------------------------------------------
// Reproduce the exact server → client audio data roundtrip
//
// Server (route.ts):  Uint8Array → uint8ArrayToRecord → JSON.stringify → SSE
// Client (page.tsx):  JSON.parse → Object.values() → new Uint8Array → Blob
//
// These tests verify that bytes are not lost, reordered, or corrupted.
// ---------------------------------------------------------------------------

/**
 * Client-side conversion — copied verbatim from app/speak/page.tsx
 * so the test breaks if the real code would break.
 */
function uint8ArrayToBlob(uint8ArrayData: Record<number, number>): Blob {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));
  return new Blob([uint8Array], { type: "audio/mpeg" });
}

describe("Audio data roundtrip: server → JSON → client", () => {
  test("small audio (10 frames): bytes survive the full roundtrip", () => {
    const original = createFakeMP3(10);
    const record = uint8ArrayToRecord(original);
    const json = JSON.stringify(record);
    const parsed: Record<number, number> = JSON.parse(json);
    const restored = new Uint8Array(Object.values(parsed));

    expect(restored.length).toBe(original.length);
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  test("large audio (200 frames, ~83KB): bytes survive the full roundtrip", () => {
    const original = createFakeMP3(200);
    const record = uint8ArrayToRecord(original);
    const json = JSON.stringify(record);
    const parsed: Record<number, number> = JSON.parse(json);
    const restored = new Uint8Array(Object.values(parsed));

    expect(restored.length).toBe(original.length);
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  test("MP3 sync word (0xFF 0xFB) is preserved at byte positions 0-1", () => {
    // If byte order is wrong, the MP3 header is garbled and browsers can't
    // decode the audio — this is the real failure mode we saw (readyState 2).
    const original = createFakeMP3(5);
    const record = uint8ArrayToRecord(original);
    const json = JSON.stringify(record);
    const parsed: Record<number, number> = JSON.parse(json);
    const restored = new Uint8Array(Object.values(parsed));

    expect(restored[0]).toBe(0xff); // sync byte 1
    expect(restored[1]).toBe(0xfb); // sync byte 2 (MPEG1, Layer3)
    expect(restored[2]).toBe(0x90); // bitrate/sample rate
    expect(restored[3]).toBe(0x00); // padding/channel
  });

  test("preserves all 256 possible byte values through the roundtrip", () => {
    // Real MP3 audio uses the full 0-255 range in frame data
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;

    const record = uint8ArrayToRecord(allBytes);
    const json = JSON.stringify(record);
    const parsed = JSON.parse(json);
    const restored = new Uint8Array(Object.values(parsed));

    expect(Array.from(restored)).toEqual(Array.from(allBytes));
  });

  test("uint8ArrayToBlob produces blob matching original bytes", async () => {
    const original = createFakeMP3(5);
    const record = uint8ArrayToRecord(original);
    const json = JSON.stringify(record);
    const parsed = JSON.parse(json);

    const blob = uint8ArrayToBlob(parsed);
    expect(blob.type).toBe("audio/mpeg");
    expect(blob.size).toBe(original.length);

    const blobBytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(blobBytes)).toEqual(Array.from(original));
  });

  test("blob starts with valid MP3 sync word", async () => {
    const original = createFakeMP3(3);
    const record = uint8ArrayToRecord(original);
    const json = JSON.stringify(record);
    const blob = uint8ArrayToBlob(JSON.parse(json));
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // A browser seeing 0xFF 0xFB knows this is a valid MP3 frame
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xfb);
  });

  test("Record key count equals original byte length", () => {
    const original = createFakeMP3(10);
    const record = uint8ArrayToRecord(original);
    const json = JSON.stringify(record);
    const parsed = JSON.parse(json);

    expect(Object.keys(parsed).length).toBe(original.length);
  });

  test("JSON payload size is reasonable (not exponentially larger than audio)", () => {
    // The Record<number,number> encoding is ~5-7x larger than raw bytes
    // because each byte becomes e.g. "123":255, (up to ~9 chars per byte).
    // This test catches if the encoding somehow blows up.
    const original = createFakeMP3(100); // ~41,700 bytes
    const record = uint8ArrayToRecord(original);
    const json = JSON.stringify(record);

    const ratio = json.length / original.length;
    // Should be roughly 5-8x, definitely under 15x
    expect(ratio).toBeLessThan(15);
    expect(ratio).toBeGreaterThan(2);
  });
});
