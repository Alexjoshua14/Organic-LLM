import { z } from "zod";

import { SpeakRealtimeVoiceSchema } from "@/lib/schemas/speak-realtime-voice";

/**
 * Seed payload for a Speak Realtime session scoped to one Arcadia subagent.
 * Client-safe: the multitask shell sends it; the session mint validates and folds
 * it into instructions.
 */
export const SpeakSubagentSeedSchema = z.object({
  agentId: z.string().min(1).max(128),
  role: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  goal: z.string().min(1).max(2_000),
  /** Free-text snapshot of current progress at session start. */
  progress: z.string().min(1).max(4_000),
  voice: SpeakRealtimeVoiceSchema,
});

export type SpeakSubagentSeed = z.infer<typeof SpeakSubagentSeedSchema>;

/** Silent background progress push while a subagent Speak session is live. */
export const SpeakSubagentProgressBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  agentId: z.string().min(1).max(128),
  role: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(80).optional(),
  progress: z.string().min(1).max(4_000),
});

export type SpeakSubagentProgressBody = z.infer<typeof SpeakSubagentProgressBodySchema>;

/** Spoken milestone push — the only subagent work event the model should announce. */
export const SpeakSubagentMilestoneBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  agentId: z.string().min(1).max(128),
  role: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(80).optional(),
  milestone: z.string().min(1).max(2_000),
  /** Optional progress snapshot accompanying the milestone. */
  progress: z.string().max(4_000).optional(),
});

export type SpeakSubagentMilestoneBody = z.infer<typeof SpeakSubagentMilestoneBodySchema>;
