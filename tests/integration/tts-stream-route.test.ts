import { describe, test, expect, mock, beforeEach } from "bun:test";

import {
  createFakeMP3,
  createMockGenerateSpeechResult,
} from "../helpers/mock-tts";
import { GENERIC_SERVER_ERROR } from "@/lib/api/client-safe-error";

// ---------------------------------------------------------------------------
// Mock the generateSpeech import BEFORE importing the route
// ---------------------------------------------------------------------------

const mockGenerateSpeech = mock(async () => createMockGenerateSpeechResult(10));

mock.module("ai", () => ({
  experimental_generateSpeech: mockGenerateSpeech,
}));

mock.module("@ai-sdk/openai", () => ({
  openai: {
    speech: (modelId: string) => ({
      modelId,
      provider: "openai.speech",
    }),
  },
}));

mock.module("@ai-sdk/elevenlabs", () => ({
  elevenlabs: {
    speech: (modelId: string) => ({
      modelId,
      provider: "elevenlabs.speech",
    }),
  },
}));

import { POST } from "@/app/api/ai/tts/stream/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://test/api/ai/tts/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Read a Response as text and parse SSE events from it.
 * Uses the exact same parsing logic as the speak page client.
 */
async function readSSEEvents(
  response: Response,
): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  const events: Array<Record<string, unknown>> = [];
  let buffer = text;

  while (true) {
    const sep = buffer.indexOf("\n\n");
    if (sep === -1) break;

    const rawEvent = buffer.slice(0, sep);
    buffer = buffer.slice(sep + 2);

    const dataLines = rawEvent
      .split("\n")
      .filter((l: string) => l.startsWith("data:"))
      .map((l: string) => l.slice(5).trimStart());

    const payload = dataLines.join("\n");
    if (!payload) continue;

    try {
      events.push(JSON.parse(payload));
    } catch {
      // skip unparseable — tests below assert this doesn't happen
    }
  }

  return events;
}

/**
 * Client-side conversion — verbatim from app/speak/page.tsx
 */
function uint8ArrayToBlob(data: Record<number, number>): Blob {
  return new Blob([new Uint8Array(Object.values(data))], {
    type: "audio/mpeg",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/ai/tts/stream", () => {
  beforeEach(() => {
    mockGenerateSpeech.mockClear();
    mockGenerateSpeech.mockImplementation(async () =>
      createMockGenerateSpeechResult(10),
    );
  });

  // --- Validation ---

  test("returns 400 when text is missing", async () => {
    const res = await POST(createRequest({}) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("returns 400 when text is empty string", async () => {
    const res = await POST(createRequest({ text: "" }) as any);
    expect(res.status).toBe(400);
  });

  test("returns 400 when text is a number", async () => {
    const res = await POST(createRequest({ text: 42 }) as any);
    expect(res.status).toBe(400);
  });

  // --- Response shape ---

  test("returns SSE stream with correct headers", async () => {
    const res = await POST(
      createRequest({ text: "Hello", model: "eleven_flash_v2_5" }) as any,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  test("SSE stream has at least one progress event and one complete event", async () => {
    const res = await POST(
      createRequest({ text: "Hello", model: "eleven_flash_v2_5" }) as any,
    );
    const events = await readSSEEvents(res);

    const progress = events.filter((e) => e.type === "progress");
    const complete = events.filter((e) => e.type === "complete");

    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(complete.length).toBe(1);
  });

  test("first progress event has stage 'starting' and progress 0", async () => {
    const res = await POST(
      createRequest({ text: "Hello", model: "eleven_flash_v2_5" }) as any,
    );
    const events = await readSSEEvents(res);
    const first = events[0];

    expect(first.type).toBe("progress");
    expect(first.progress).toBe(0);
    expect(first.stage).toBe("starting");
    expect(first.estimatedMs).toBeGreaterThan(0);
  });

  // --- Complete event ---

  test("complete event has audioData, format, mediaType, and progress=100", async () => {
    const res = await POST(
      createRequest({ text: "Test", model: "gpt-4o-mini-tts" }) as any,
    );
    const events = await readSSEEvents(res);
    const complete = events.find((e) => e.type === "complete")!;

    expect(complete).toBeDefined();
    expect(complete.audioData).toBeDefined();
    expect(typeof complete.audioData).toBe("object");
    expect(complete.format).toBe("mp3");
    expect(complete.mediaType).toBe("audio/mpeg");
    expect(complete.progress).toBe(100);
    expect(complete.actualDurationMs).toBeDefined();
  });

  test("audioData byte count matches source audio byte count", async () => {
    const mp3Frames = 8;
    const expectedLength = createFakeMP3(mp3Frames).length;

    mockGenerateSpeech.mockImplementation(async () =>
      createMockGenerateSpeechResult(mp3Frames),
    );

    const res = await POST(
      createRequest({ text: "T", model: "eleven_flash_v2_5" }) as any,
    );
    const events = await readSSEEvents(res);
    const complete = events.find((e) => e.type === "complete")!;
    const audioData = complete.audioData as Record<string, number>;

    expect(Object.keys(audioData).length).toBe(expectedLength);
  });

  test("audioData bytes survive full roundtrip to Uint8Array", async () => {
    const mp3Frames = 5;
    const originalAudio = createFakeMP3(mp3Frames);

    mockGenerateSpeech.mockImplementation(async () =>
      createMockGenerateSpeechResult(mp3Frames),
    );

    const res = await POST(
      createRequest({ text: "Roundtrip", model: "eleven_flash_v2_5" }) as any,
    );
    const events = await readSSEEvents(res);
    const complete = events.find((e) => e.type === "complete")!;
    const restored = new Uint8Array(
      Object.values(complete.audioData as Record<string, number>),
    );

    expect(restored.length).toBe(originalAudio.length);
    expect(Array.from(restored)).toEqual(Array.from(originalAudio));
  });

  test("audioData preserves MP3 header bytes through route", async () => {
    const mp3Frames = 3;
    mockGenerateSpeech.mockImplementation(async () =>
      createMockGenerateSpeechResult(mp3Frames),
    );

    const res = await POST(
      createRequest({ text: "Header", model: "eleven_flash_v2_5" }) as any,
    );
    const events = await readSSEEvents(res);
    const complete = events.find((e) => e.type === "complete")!;
    const blob = uint8ArrayToBlob(complete.audioData as Record<number, number>);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // MP3 sync word must be intact for browser to decode
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xfb);
  });

  // --- Voice selection ---

  test("uses ElevenLabs voice for ElevenLabs models", async () => {
    const res = await POST(
      createRequest({ text: "Voice test", model: "eleven_flash_v2_5" }) as any,
    );
    await readSSEEvents(res); // consume response

    const call = mockGenerateSpeech.mock.calls[0][0] as any;
    expect(call.model.provider).toBe("elevenlabs.speech");
    expect(call.voice).toBe("19STyYD15bswVz51nqLf");
  });

  test("uses OpenAI voice for OpenAI models", async () => {
    const res = await POST(
      createRequest({ text: "Voice test", model: "gpt-4o-mini-tts" }) as any,
    );
    await readSSEEvents(res);

    const call = mockGenerateSpeech.mock.calls[0][0] as any;
    expect(call.model.provider).toBe("openai.speech");
    expect(call.voice).toBe("nova");
  });

  // --- Passthrough fields ---

  test("segmentId is echoed in all progress and complete events", async () => {
    const res = await POST(
      createRequest({
        text: "Seg test",
        model: "eleven_flash_v2_5",
        segmentId: "seg-42",
      }) as any,
    );
    const events = await readSSEEvents(res);

    for (const event of events) {
      if (event.type === "progress" || event.type === "complete") {
        expect(event.segmentId).toBe("seg-42");
      }
    }
  });

  // --- Error handling ---

  test("returns error SSE event when generateSpeech throws", async () => {
    mockGenerateSpeech.mockImplementation(async () => {
      throw new Error("API rate limit exceeded");
    });

    const res = await POST(
      createRequest({ text: "Fail", model: "eleven_flash_v2_5" }) as any,
    );
    // Should still be 200 (SSE stream), error is in the event
    expect(res.status).toBe(200);

    const events = await readSSEEvents(res);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    // Internal error details are logged server-side only; client gets a generic message.
    expect(errorEvent!.error).toBe(GENERIC_SERVER_ERROR);
  });

  test("defaults to first available model when model param is invalid", async () => {
    const res = await POST(
      createRequest({ text: "Fallback", model: "nonexistent_model" }) as any,
    );
    const events = await readSSEEvents(res);

    // Should still succeed — falls back to availableSpeechModels[0]
    const complete = events.find((e) => e.type === "complete");
    expect(complete).toBeDefined();
    expect(mockGenerateSpeech).toHaveBeenCalledTimes(1);
  });
});
