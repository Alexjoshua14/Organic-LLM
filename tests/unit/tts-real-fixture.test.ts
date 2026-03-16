/**
 * Tests using REAL audio data captured from ElevenLabs.
 *
 * These tests use the fixture at tests/fixtures/generate-speech-response.json.
 * If the fixture is missing, they are skipped (not failed).
 *
 * Run `LOG_TTS_FIXTURE=1 bun run dev` and generate speech to capture fixtures.
 * See tests/fixtures/README.md for details.
 */

import { describe, test, expect } from "bun:test";

import {
  loadGenerateSpeechFixture,
  createRealGenerateSpeechResult,
  uint8ArrayToRecord,
} from "../helpers/mock-tts";
import { decodeAudioBase64 } from "@/lib/llm/tts/helpers";

// ---------------------------------------------------------------------------
// Load fixture — all tests in this file are conditional on it existing
// ---------------------------------------------------------------------------

const fixture = loadGenerateSpeechFixture();
const hasFixture = fixture !== null;

function skipIfNoFixture() {
  if (!hasFixture) {
    console.log("  ⏭  Skipping: no generate-speech-response.json fixture");
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Real ElevenLabs fixture", () => {
  test("fixture file exists and has expected shape", () => {
    skipIfNoFixture();
    if (!hasFixture) return;

    expect(fixture!._meta).toBeDefined();
    expect(fixture!._meta.text).toBeTruthy();
    expect(fixture!._meta.byteLength).toBeGreaterThan(0);
    expect(fixture!.audioBase64).toBeTruthy();
    expect(fixture!.audioBase64.length).toBeGreaterThan(100);
  });

  test("audioBase64 decodes to correct byte length", () => {
    skipIfNoFixture();
    if (!hasFixture) return;

    const bytes = Buffer.from(fixture!.audioBase64, "base64");
    expect(bytes.length).toBe(fixture!._meta.byteLength);
  });

  test("decoded audio starts with valid MP3 sync word", () => {
    skipIfNoFixture();
    if (!hasFixture) return;

    const bytes = Buffer.from(fixture!.audioBase64, "base64");

    // ID3 tag starts with "ID3" (0x49 0x44 0x33) — many MP3 files have this
    // before the actual frames. The raw MP3 sync is 0xFF 0xFB/0xFF 0xFA etc.
    const startsWithID3 =
      bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    const startsWithSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;

    expect(startsWithID3 || startsWithSync).toBe(true);
  });

  test("audio bytes survive the full server→client roundtrip", () => {
    skipIfNoFixture();
    if (!hasFixture) return;

    const originalBytes = Buffer.from(fixture!.audioBase64, "base64");
    const original = new Uint8Array(originalBytes);

    // Server side: Uint8Array → Record
    const record = uint8ArrayToRecord(original);
    // Wire: JSON.stringify → JSON.parse
    const json = JSON.stringify(record);
    const parsed: Record<number, number> = JSON.parse(json);
    // Client side: Object.values → Uint8Array
    const restored = new Uint8Array(Object.values(parsed));

    expect(restored.length).toBe(original.length);
    // Check first 10 bytes (header)
    for (let i = 0; i < 10; i++) {
      expect(restored[i]).toBe(original[i]);
    }
    // Check last 10 bytes (tail)
    for (let i = original.length - 10; i < original.length; i++) {
      expect(restored[i]).toBe(original[i]);
    }
    // Full equality
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  test("audio bytes survive roundtrip through Blob", async () => {
    skipIfNoFixture();
    if (!hasFixture) return;

    const originalBytes = new Uint8Array(
      Buffer.from(fixture!.audioBase64, "base64"),
    );

    // Simulate the full pipeline
    const record = uint8ArrayToRecord(originalBytes);
    const json = JSON.stringify(record);
    const parsed = JSON.parse(json);
    const blob = new Blob([new Uint8Array(Object.values(parsed))], {
      type: "audio/mpeg",
    });
    const blobBytes = new Uint8Array(await blob.arrayBuffer());

    expect(blobBytes.length).toBe(originalBytes.length);
    expect(blob.type).toBe("audio/mpeg");
    expect(Array.from(blobBytes)).toEqual(Array.from(originalBytes));
  });

  test("JSON payload size is proportional to audio size", () => {
    skipIfNoFixture();
    if (!hasFixture) return;

    const bytes = new Uint8Array(Buffer.from(fixture!.audioBase64, "base64"));
    const record = uint8ArrayToRecord(bytes);
    const json = JSON.stringify(record);

    const ratio = json.length / bytes.length;
    // Record encoding is ~5-8x the raw byte count
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(15);

    // Log for visibility
    console.log(
      `  ℹ  Real audio: ${bytes.length} bytes → ${json.length} chars JSON (${ratio.toFixed(1)}x)`,
    );
  });

  test("createRealGenerateSpeechResult returns correct shape", () => {
    const result = createRealGenerateSpeechResult();

    expect(result.audio).toBeDefined();
    expect(result.audio.uint8Array).toBeInstanceOf(Uint8Array);
    expect(result.audio.uint8Array.length).toBeGreaterThan(0);
    expect(result.audio.format).toBeTruthy();
    expect(result.audio.mimeType).toBeTruthy();

    if (hasFixture) {
      // When using real fixture, byte length should match _meta
      expect(result.audio.uint8Array.length).toBe(fixture!._meta.byteLength);
      expect(result._meta).toBeDefined();
    }
  });
});
