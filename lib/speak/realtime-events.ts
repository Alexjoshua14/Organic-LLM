/**
 * Classifies raw OpenAI Realtime server events into the small set of actions the Speak hook
 * reacts to. Kept pure so the GA/beta event-name handling and usage extraction are unit-testable
 * without a peer connection.
 *
 * The GA interface (`type: "realtime"` sessions) names transcript events
 * `response.output_audio_transcript.*`; the beta interface used `response.audio_transcript.*`.
 * Both are accepted so a model or account still on the older names keeps producing captions.
 */

export type RealtimeUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  audioInputTokens: number;
  audioOutputTokens: number;
};

export type SpeakRealtimeEvent =
  | { kind: "user_speech_started" }
  | { kind: "user_speech_stopped" }
  | { kind: "assistant_started" }
  | { kind: "assistant_finished"; usage: RealtimeUsage | null }
  | { kind: "assistant_audio_stopped" }
  /**
   * WebRTC only: model audio actually reaching the speaker. Playback outlives `response.done`,
   * so these, not the response lifecycle, say whether the model is still talking.
   */
  | { kind: "assistant_playback_started" }
  | { kind: "assistant_playback_stopped" }
  | { kind: "user_transcript"; text: string; itemId: string | null }
  | { kind: "assistant_transcript_delta"; delta: string }
  | { kind: "assistant_transcript"; text: string; itemId: string | null }
  | { kind: "tool_call"; callId: string; name: string; args: string }
  | { kind: "error"; message: string }
  | { kind: "ignore"; type: string };

const EMPTY_USAGE: RealtimeUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  audioInputTokens: 0,
  audioOutputTokens: 0,
};

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Maps `response.done.response.usage` onto the shape `lib/rate-limit/llm-cost.ts` prices.
 * Text and audio tokens are priced separately, so they are split via `*_token_details`
 * rather than taken from the combined `input_tokens` / `output_tokens` totals.
 */
export function usageFromResponseDone(event: Record<string, unknown>): RealtimeUsage | null {
  const response = event.response;

  if (!response || typeof response !== "object") return null;

  const usage = (response as Record<string, unknown>).usage;

  if (!usage || typeof usage !== "object") return null;

  const u = usage as Record<string, unknown>;
  const inDetails = (u.input_token_details ?? {}) as Record<string, unknown>;
  const outDetails = (u.output_token_details ?? {}) as Record<string, unknown>;

  const audioIn = num(inDetails.audio_tokens);
  const audioOut = num(outDetails.audio_tokens);
  const textIn = num(inDetails.text_tokens) || Math.max(0, num(u.input_tokens) - audioIn);
  const textOut = num(outDetails.text_tokens) || Math.max(0, num(u.output_tokens) - audioOut);

  const result: RealtimeUsage = {
    inputTokens: textIn,
    outputTokens: textOut,
    cachedInputTokens: num(inDetails.cached_tokens),
    audioInputTokens: audioIn,
    audioOutputTokens: audioOut,
  };

  const total =
    result.inputTokens + result.outputTokens + result.audioInputTokens + result.audioOutputTokens;

  return total > 0 ? result : null;
}

export function sumRealtimeUsage(
  a: RealtimeUsage | null,
  b: RealtimeUsage | null
): RealtimeUsage | null {
  if (!a) return b;
  if (!b) return a;

  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    audioInputTokens: a.audioInputTokens + b.audioInputTokens,
    audioOutputTokens: a.audioOutputTokens + b.audioOutputTokens,
  };
}

export function emptyRealtimeUsage(): RealtimeUsage {
  return { ...EMPTY_USAGE };
}

export function classifyRealtimeEvent(event: Record<string, unknown>): SpeakRealtimeEvent {
  const type = String(event.type ?? "");

  switch (type) {
    case "input_audio_buffer.speech_started":
      return { kind: "user_speech_started" };
    case "input_audio_buffer.speech_stopped":
      return { kind: "user_speech_stopped" };
    case "response.created":
    case "response.output_audio.delta":
    case "response.audio.delta":
      return { kind: "assistant_started" };
    case "response.done":
      return { kind: "assistant_finished", usage: usageFromResponseDone(event) };
    case "response.output_audio.done":
    case "response.audio.done":
      return { kind: "assistant_audio_stopped" };
    case "output_audio_buffer.started":
      return { kind: "assistant_playback_started" };
    // `cleared` is the interruption path: the user talked over the model and the buffer was dropped.
    case "output_audio_buffer.stopped":
    case "output_audio_buffer.cleared":
      return { kind: "assistant_playback_stopped" };
    case "conversation.item.input_audio_transcription.completed": {
      const text = String(event.transcript ?? "").trim();

      return { kind: "user_transcript", text, itemId: str(event.item_id) };
    }
    case "response.output_audio_transcript.delta":
    case "response.audio_transcript.delta":
      return { kind: "assistant_transcript_delta", delta: String(event.delta ?? "") };
    case "response.output_audio_transcript.done":
    case "response.audio_transcript.done": {
      const text = String(event.transcript ?? "").trim();

      return { kind: "assistant_transcript", text, itemId: str(event.item_id) };
    }
    case "response.function_call_arguments.done": {
      const callId = str(event.call_id);
      const name = str(event.name);

      if (!callId || !name) return { kind: "ignore", type };

      return {
        kind: "tool_call",
        callId,
        name,
        args: typeof event.arguments === "string" ? event.arguments : "{}",
      };
    }
    case "error": {
      const err = (event.error ?? {}) as Record<string, unknown>;

      return { kind: "error", message: str(err.message) ?? "Realtime error" };
    }
    default:
      return { kind: "ignore", type };
  }
}
