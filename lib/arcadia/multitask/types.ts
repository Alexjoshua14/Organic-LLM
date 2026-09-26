import type { SpeakRealtimeVoice } from "@/lib/schemas/speak-realtime-voice";

export type ArcadiaSubagentStatus = "idle" | "working" | "blocked" | "done";

export type ArcadiaSubagentMilestone = {
  id: string;
  label: string;
  at: number;
};

/**
 * Client model for the Arcadia multitask shell.
 *
 * Honest sandbox source: there is no production multi-agent runtime yet. The shell
 * drives Speak from this model (goal, progress, milestones, status, stable voice).
 */
export type ArcadiaSubagent = {
  id: string;
  name: string;
  role: string;
  /** One-line character framing shown in the condensed card. */
  blurb: string;
  goal: string;
  /** Latest progress narrative the Speak session should know. */
  progress: string;
  /** Percent 0–100 for the condensed meter; narrative is in `progress`. */
  progressPct: number;
  status: ArcadiaSubagentStatus;
  milestones: ArcadiaSubagentMilestone[];
  /** Stable OpenAI Realtime voice id for this agent. */
  voiceId: SpeakRealtimeVoice;
  /**
   * Optional identity image URL (non-human portrait slot). Other work may populate this;
   * the card keeps the slot even when empty.
   */
  identityImageUrl?: string | null;
};

export type ArcadiaMultitaskSpeakBinding = {
  agentId: string;
  sessionStartedAt: number;
};
