import { describe, expect, test } from "bun:test";

import {
  classifyRealtimeEvent,
  sumRealtimeUsage,
  usageFromResponseDone,
} from "@/lib/speak/realtime-events";

describe("classifyRealtimeEvent playback", () => {
  test("WebRTC playback start and drain map to their own kinds", () => {
    expect(classifyRealtimeEvent({ type: "output_audio_buffer.started" }).kind).toBe(
      "assistant_playback_started"
    );
    expect(classifyRealtimeEvent({ type: "output_audio_buffer.stopped" }).kind).toBe(
      "assistant_playback_stopped"
    );
  });

  test("an interruption clearing the buffer also ends playback", () => {
    expect(classifyRealtimeEvent({ type: "output_audio_buffer.cleared" }).kind).toBe(
      "assistant_playback_stopped"
    );
  });

  test("audio generation finishing is not playback finishing", () => {
    expect(classifyRealtimeEvent({ type: "response.output_audio.done" }).kind).toBe(
      "assistant_audio_stopped"
    );
  });
});

describe("classifyRealtimeEvent transcript names", () => {
  test("accepts the GA assistant transcript event", () => {
    const ev = classifyRealtimeEvent({
      type: "response.output_audio_transcript.done",
      transcript: "  Hello there. ",
      item_id: "item_1",
    });

    expect(ev).toEqual({ kind: "assistant_transcript", text: "Hello there.", itemId: "item_1" });
  });

  test("still accepts the beta assistant transcript event", () => {
    const ev = classifyRealtimeEvent({ type: "response.audio_transcript.done", transcript: "Hi" });

    expect(ev.kind).toBe("assistant_transcript");
  });

  test("deltas map for both names", () => {
    expect(
      classifyRealtimeEvent({ type: "response.output_audio_transcript.delta", delta: "a" })
    ).toEqual({ kind: "assistant_transcript_delta", delta: "a" });
    expect(classifyRealtimeEvent({ type: "response.audio_transcript.delta", delta: "b" })).toEqual({
      kind: "assistant_transcript_delta",
      delta: "b",
    });
  });

  test("user transcription completion carries the item id", () => {
    const ev = classifyRealtimeEvent({
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "What did we decide?",
      item_id: "item_u",
    });

    expect(ev).toEqual({ kind: "user_transcript", text: "What did we decide?", itemId: "item_u" });
  });
});

describe("classifyRealtimeEvent tool calls and errors", () => {
  test("tool call requires call_id and name", () => {
    expect(
      classifyRealtimeEvent({
        type: "response.function_call_arguments.done",
        call_id: "c1",
        name: "search_memories",
        arguments: '{"query":"coffee"}',
      })
    ).toEqual({ kind: "tool_call", callId: "c1", name: "search_memories", args: '{"query":"coffee"}' });

    expect(
      classifyRealtimeEvent({ type: "response.function_call_arguments.done", name: "x" }).kind
    ).toBe("ignore");
  });

  test("server error events surface a message", () => {
    expect(classifyRealtimeEvent({ type: "error", error: { message: "bad" } })).toEqual({
      kind: "error",
      message: "bad",
    });
  });

  test("unknown events are ignored, not thrown", () => {
    expect(classifyRealtimeEvent({ type: "session.updated" })).toEqual({
      kind: "ignore",
      type: "session.updated",
    });
  });
});

describe("usageFromResponseDone", () => {
  test("splits text and audio tokens and reads cached input", () => {
    const usage = usageFromResponseDone({
      type: "response.done",
      response: {
        usage: {
          input_tokens: 500,
          output_tokens: 200,
          input_token_details: { text_tokens: 300, audio_tokens: 200, cached_tokens: 100 },
          output_token_details: { text_tokens: 50, audio_tokens: 150 },
        },
      },
    });

    expect(usage).toEqual({
      inputTokens: 300,
      outputTokens: 50,
      cachedInputTokens: 100,
      audioInputTokens: 200,
      audioOutputTokens: 150,
    });
  });

  test("derives text tokens from totals when details are missing", () => {
    const usage = usageFromResponseDone({
      response: {
        usage: {
          input_tokens: 120,
          output_tokens: 80,
          input_token_details: { audio_tokens: 20 },
          output_token_details: { audio_tokens: 30 },
        },
      },
    });

    expect(usage?.inputTokens).toBe(100);
    expect(usage?.outputTokens).toBe(50);
  });

  test("returns null when there is no usage", () => {
    expect(usageFromResponseDone({ type: "response.done", response: {} })).toBeNull();
    expect(classifyRealtimeEvent({ type: "response.done" })).toEqual({
      kind: "assistant_finished",
      usage: null,
    });
  });
});

describe("sumRealtimeUsage", () => {
  test("adds field-wise and tolerates nulls", () => {
    const a = {
      inputTokens: 1,
      outputTokens: 2,
      cachedInputTokens: 3,
      audioInputTokens: 4,
      audioOutputTokens: 5,
    };

    expect(sumRealtimeUsage(null, a)).toEqual(a);
    expect(sumRealtimeUsage(a, null)).toEqual(a);
    expect(sumRealtimeUsage(a, a)).toEqual({
      inputTokens: 2,
      outputTokens: 4,
      cachedInputTokens: 6,
      audioInputTokens: 8,
      audioOutputTokens: 10,
    });
  });
});
