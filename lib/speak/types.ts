import type { SpeakModalities } from "@/lib/schemas/speak-modalities";

export type SpeakBudgetSnapshot = {
  monthlyCostCapUsd: number;
  monthlyCostUsedUsd: number;
  monthlyCostRemainingUsd: number;
  dailyMinutesCap: number;
  dailyMinutesRemaining: number;
  sessionMaxMinutes: number;
  concurrentSessions: number;
  activeSessions: number;
};

export type SpeakToolClientEffect =
  | { type: "display_text"; text: string }
  | { type: "gen_ui"; block: unknown; instanceId: string }
  | { type: "refresh_component"; instanceId: string }
  | {
      type: "upsert_ui_state";
      surfaceId: string;
      items: Array<{ id: string; data: Record<string, unknown> }>;
    }
  | { type: "web_preview"; url: string; title?: string };

export type SpeakRealtimeSessionPublic = {
  sessionId: string;
  model: string;
  threadId: string | null;
  modalities: SpeakModalities;
  minutesUsed: number;
  costUsd: number;
  status: "active" | "closed";
};

/**
 * Server-assembled priming context for a Realtime voice session. Built once at
 * session mint from existing memory + thread pieces and folded into the agent's
 * instructions. Memory text stays server-side; only the final instruction
 * string is sent to OpenAI.
 */
export type SpeakContext = {
  /** Salient memories about the user (`formatMemoriesForPrompt` output). */
  memoryDump: string | null;
  /** Cached "who this user is" overview, included only when a fresh one exists. */
  overview: string | null;
  /** Rolling conversation summary for the resumed thread. */
  recap: string | null;
  /** A few most-recent turns rendered as plain text, for near-term recall. */
  recentTurns: string | null;
  /** Natural phrase for time since last talk; null for a brand-new thread. */
  elapsedPhrase: string | null;
  /** True when resuming an existing thread with prior activity. */
  resumed: boolean;
};

/** A single finalized voice turn queued for persistence. */
export type SpeakTurn = {
  role: "user" | "assistant";
  text: string;
};
