import { z } from "zod";

/**
 * Built-in OpenAI Realtime output voices the Speak session mint accepts.
 * Source: `openai.realtime.clientSecrets` audio.output.voice (SDK types).
 * Default Speak Live uses {@link DEFAULT_SPEAK_REALTIME_VOICE}.
 */
export const SPEAK_REALTIME_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export const SpeakRealtimeVoiceSchema = z.enum(SPEAK_REALTIME_VOICES);

export type SpeakRealtimeVoice = z.infer<typeof SpeakRealtimeVoiceSchema>;

/** Product default for ordinary Speak Live (unchanged from the pre-multitask mint). */
export const DEFAULT_SPEAK_REALTIME_VOICE: SpeakRealtimeVoice = "alloy";
