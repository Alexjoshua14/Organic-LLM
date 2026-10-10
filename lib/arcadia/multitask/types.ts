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
 * Roster identities are fixture slots; status/progress come from live worker runs
 * (awareness events). Speak still seeds from this model when a session is open.
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
  /** The subagent's own thread once the orchestrator has assigned it work (COA-251). */
  threadId?: string | null;
};

export type ArcadiaMultitaskSpeakBinding = {
  agentId: string;
  sessionStartedAt: number;
};
