import {
  DEFAULT_SPEAK_REALTIME_VOICE,
  SPEAK_REALTIME_VOICES,
  type SpeakRealtimeVoice,
} from "@/lib/schemas/speak-realtime-voice";

/**
 * Stable preferred voice per Arcadia multitask *role*.
 * Documented next to the shell UI so assignment is not a magic list.
 *
 * Voices are OpenAI Realtime built-ins from {@link SPEAK_REALTIME_VOICES}.
 * Concurrent agents get distinct voices when the pool still has free ones;
 * only then does assignment cycle.
 */
export const ARCADIA_ROLE_VOICE_PRESETS: Readonly<Record<string, SpeakRealtimeVoice>> = {
  researcher: "marin",
  coder: "cedar",
  planner: "sage",
  writer: "coral",
  critic: "ash",
  scout: "verse",
  synthesizer: "ballad",
  coordinator: "echo",
  archivist: "shimmer",
  /** Fallback role when a demo agent has no preset. */
  generalist: DEFAULT_SPEAK_REALTIME_VOICE,
};

export type VoiceAssignable = {
  id: string;
  role: string;
};

/**
 * Assigns a Realtime voice id to each agent.
 *
 * 1. Prefer {@link ARCADIA_ROLE_VOICE_PRESETS} for the role.
 * 2. If that voice is already taken by another *concurrent* agent and unused
 *    voices remain, pick the next free voice in {@link SPEAK_REALTIME_VOICES}.
 * 3. If the pool is exhausted, cycle from the start (two agents may then share).
 */
export function assignDistinctVoices(agents: VoiceAssignable[]): Map<string, SpeakRealtimeVoice> {
  const assigned = new Map<string, SpeakRealtimeVoice>();
  const used = new Set<SpeakRealtimeVoice>();

  for (const agent of agents) {
    const preferred =
      ARCADIA_ROLE_VOICE_PRESETS[agent.role] ??
      ARCADIA_ROLE_VOICE_PRESETS.generalist ??
      DEFAULT_SPEAK_REALTIME_VOICE;

    let voice = preferred;

    if (used.has(voice)) {
      const free = SPEAK_REALTIME_VOICES.find((v) => !used.has(v));

      if (free) {
        voice = free;
      } else {
        // Pool exhausted — cycle by concurrent index so assignment stays deterministic.
        const index = assigned.size % SPEAK_REALTIME_VOICES.length;

        voice = SPEAK_REALTIME_VOICES[index]!;
      }
    }

    assigned.set(agent.id, voice);
    used.add(voice);
  }

  return assigned;
}

/** Human-readable roster lines for the shell legend. */
export function formatVoiceRosterLines(
  agents: Array<VoiceAssignable & { name: string; voiceId: SpeakRealtimeVoice }>
): string[] {
  return agents.map((a) => `${a.name} (${a.role}) → ${a.voiceId}`);
}
