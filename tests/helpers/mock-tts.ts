/**
 * Mock TTS data for testing.
 *
 * Provides fake MP3 audio bytes, ElevenLabs-style alignment chunks,
 * real captured fixtures, and helpers to build NDJSON / SSE streams
 * without calling real APIs.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { AlignmentData } from "@/lib/schemas/tts";

// ---------------------------------------------------------------------------
// Fake MP3 frame
// ---------------------------------------------------------------------------

/**
 * Minimal valid MP3 frame header (MPEG1 Layer 3, 128kbps, 44100Hz, stereo).
 * The header is 4 bytes: 0xFF 0xFB 0x90 0x00
 * We pad it to 417 bytes (one MPEG1 Layer3 128kbps frame) with zeros so
 * decoders see a valid (silent) frame.
 */
function createFakeMP3Frame(): Uint8Array {
  const FRAME_SIZE = 417; // bytes per frame at 128kbps / 44100Hz
  const frame = new Uint8Array(FRAME_SIZE);
  frame[0] = 0xff; // sync
  frame[1] = 0xfb; // MPEG1, Layer3, no CRC
  frame[2] = 0x90; // 128kbps, 44100Hz
  frame[3] = 0x00; // padding, stereo
  return frame;
}

/**
 * Create a fake MP3 buffer with N silent frames (~0.026s each at 44100Hz).
 */
export function createFakeMP3(frameCount = 10): Uint8Array {
  const frame = createFakeMP3Frame();
  const buf = new Uint8Array(frame.length * frameCount);
  for (let i = 0; i < frameCount; i++) {
    buf.set(frame, i * frame.length);
  }
  return buf;
}

/**
 * Encode a Uint8Array to base64 (works in both Node/Bun and browser).
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Buffer.from is available in Bun/Node
  return Buffer.from(bytes).toString("base64");
}

// ---------------------------------------------------------------------------
// Fake alignment data (ElevenLabs streamWithTimestamps format)
// ---------------------------------------------------------------------------

/**
 * Create a fake alignment for a word.
 * Each character gets a ~50ms window starting from `startSeconds`.
 */
export function createFakeAlignment(
  text: string,
  startSeconds: number = 0,
  charDuration: number = 0.05,
): AlignmentData {
  const characters = text.split("");
  const characterStartTimesSeconds: number[] = [];
  const characterEndTimesSeconds: number[] = [];

  let t = startSeconds;
  for (let i = 0; i < characters.length; i++) {
    characterStartTimesSeconds.push(parseFloat(t.toFixed(4)));
    t += charDuration;
    characterEndTimesSeconds.push(parseFloat(t.toFixed(4)));
  }

  return { characters, characterStartTimesSeconds, characterEndTimesSeconds };
}

/**
 * Build a complete audio stream chunk (like one line of ElevenLabs NDJSON).
 */
export function createMockAudioChunk(opts: {
  text?: string;
  startSeconds?: number;
  mp3Frames?: number;
  includeNormalized?: boolean;
}) {
  const {
    text = "Hello",
    startSeconds = 0,
    mp3Frames = 5,
    includeNormalized = true,
  } = opts;

  const audio = createFakeMP3(mp3Frames);
  const alignment = createFakeAlignment(text, startSeconds);

  return {
    audioBase64: uint8ArrayToBase64(audio),
    alignment,
    normalizedAlignment: includeNormalized ? alignment : undefined,
  };
}

// ---------------------------------------------------------------------------
// SSE helpers (for /api/ai/tts/stream mock)
// ---------------------------------------------------------------------------

/**
 * Convert a Uint8Array to a Record<number,number> the same way the real
 * server route does (uint8ArrayToRecord).
 */
export function uint8ArrayToRecord(bytes: Uint8Array): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i]!;
  }
  return out;
}

/**
 * Build a mock SSE stream body matching /api/ai/tts/stream output.
 * Returns a string containing all SSE events.
 */
export function buildMockSSEStream(opts?: {
  text?: string;
  segmentId?: string;
  mp3Frames?: number;
}): string {
  const {
    text = "Hello world",
    segmentId = "seg-1",
    mp3Frames = 10,
  } = opts ?? {};

  const audio = createFakeMP3(mp3Frames);
  const audioData = uint8ArrayToRecord(audio);

  const events: string[] = [];

  // Progress event
  events.push(
    `data: ${JSON.stringify({
      type: "progress",
      progress: 0,
      stage: "starting",
      estimatedMs: 500,
      segmentId,
    })}`,
  );

  // Another progress event
  events.push(
    `data: ${JSON.stringify({
      type: "progress",
      progress: 50,
      stage: "generating",
      segmentId,
    })}`,
  );

  // Complete event with audio
  events.push(
    `data: ${JSON.stringify({
      type: "complete",
      progress: 100,
      stage: "complete",
      actualDurationMs: 200,
      segmentId,
      audioData,
      format: "mp3",
      mediaType: "audio/mpeg",
    })}`,
  );

  // SSE events are separated by double newlines
  return events.join("\n\n") + "\n\n";
}

// ---------------------------------------------------------------------------
// NDJSON helpers (for /api/ai/tts-v2 mock, ElevenLabs streaming)
// ---------------------------------------------------------------------------

/**
 * Build a mock NDJSON stream (like ElevenLabs streamWithTimestamps output).
 * Returns a string with one JSON object per line.
 */
export function buildMockNDJSONStream(
  chunks: Array<{
    text: string;
    startSeconds?: number;
    mp3Frames?: number;
  }>,
): string {
  const lines: string[] = [];
  let currentStart = 0;

  for (const chunk of chunks) {
    const start = chunk.startSeconds ?? currentStart;
    const data = createMockAudioChunk({
      text: chunk.text,
      startSeconds: start,
      mp3Frames: chunk.mp3Frames ?? 5,
    });
    lines.push(JSON.stringify(data));
    // Advance start for next chunk
    const charDur = 0.05;
    currentStart = start + chunk.text.length * charDur;
  }

  return lines.join("\n") + "\n";
}

/**
 * Create a mock generateSpeech result matching the Vercel AI SDK shape.
 */
export function createMockGenerateSpeechResult(mp3Frames = 10) {
  const audio = createFakeMP3(mp3Frames);
  return {
    audio: {
      uint8Array: audio,
      format: "mp3",
      mimeType: "audio/mpeg",
    },
  };
}

// ---------------------------------------------------------------------------
// Real fixture loading (captured from actual ElevenLabs / AI SDK responses)
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(__dirname, "../fixtures");

type GenerateSpeechFixture = {
  _meta: {
    text: string;
    model: string;
    provider: string;
    byteLength: number;
    capturedAt: string;
  };
  audioBase64: string;
  format: string | null;
  mimeType: string | null;
  mediaType: string | null;
};

type ElevenLabsStreamFixture = {
  _meta: {
    text: string;
    model: string;
    voiceId: string;
    chunkCount: number;
    capturedAt: string;
  };
  chunks: Array<{
    audioBase64: string;
    alignment?: AlignmentData;
    normalizedAlignment?: AlignmentData;
  }>;
};

/**
 * Load the real generate-speech-response.json fixture.
 * Returns null if the fixture file doesn't exist.
 */
export function loadGenerateSpeechFixture(): GenerateSpeechFixture | null {
  const path = join(FIXTURES_DIR, "generate-speech-response.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Load the real elevenlabs-stream-response.json fixture.
 * Returns null if the fixture file doesn't exist.
 */
export function loadElevenLabsStreamFixture(): ElevenLabsStreamFixture | null {
  const path = join(FIXTURES_DIR, "elevenlabs-stream-response.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Create a generateSpeech result from the real fixture, matching the AI SDK shape.
 * Falls back to fake MP3 if fixture not available.
 */
export function createRealGenerateSpeechResult(): {
  audio: { uint8Array: Uint8Array; format: string; mimeType: string };
  _meta?: GenerateSpeechFixture["_meta"];
} {
  const fixture = loadGenerateSpeechFixture();
  if (!fixture) {
    return createMockGenerateSpeechResult(10);
  }
  const bytes = Buffer.from(fixture.audioBase64, "base64");
  return {
    audio: {
      uint8Array: new Uint8Array(bytes),
      format: fixture.format ?? "mp3",
      mimeType: fixture.mediaType ?? fixture.mimeType ?? "audio/mpeg",
    },
    _meta: fixture._meta,
  };
}
