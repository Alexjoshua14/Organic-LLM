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
