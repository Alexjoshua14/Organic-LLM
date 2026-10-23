import { z } from "zod";

/**
 * Client-safe contracts for the Arcadia Jev-mode tools. Server tools live in
 * `lib/llm/voice-reply-tool.ts` and `lib/llm/rabbit-hole-create-tool.ts`; the chat UI parses
 * their persisted outputs with the schemas here.
 */

export const VOICE_REPLY_TOOL_NAME = "voice_reply";
export const CREATE_RABBIT_HOLE_TOOL_NAME = "create_rabbit_hole";

export const VoiceReplyInputSchema = z.object({
  script: z
    .string()
    .min(1)
    .max(1500)
    .describe(
      "Exactly the words to speak. Plain conversational sentences; no markdown, lists, URLs, emoji, or code. At most 30 seconds of speech (about 75 words) — longer scripts are cut off."
    ),
  onScreen: z
    .string()
    .max(1500)
    .optional()
    .describe(
      "Optional short markdown shown under the audio player for things that must be read rather than heard: code, links, exact figures. Omit when the script says it all."
    ),
});

export type VoiceReplyInput = z.infer<typeof VoiceReplyInputSchema>;

export const VoiceReplyOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    /** Script after the 30-second word cap. */
    script: z.string(),
    onScreen: z.string().optional(),
    truncated: z.boolean(),
    maxSeconds: z.number().positive(),
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);

export type VoiceReplyOutput = z.infer<typeof VoiceReplyOutputSchema>;

export const RabbitHoleCreateInputSchema = z.object({
  question: z
    .string()
    .min(3)
    .max(300)
    .describe(
      "The root question for the new rabbit hole, phrased as the user would ask it (e.g. 'Why did Roman concrete last so long?')."
    ),
});

export type RabbitHoleCreateInput = z.infer<typeof RabbitHoleCreateInputSchema>;

export const RABBIT_HOLE_CREATE_FAILURE_REASONS = ["per_turn_limit", "rate_limited", "failed"] as const;

export const RabbitHoleCreateOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    sessionId: z.string(),
    nodeId: z.string(),
    question: z.string(),
    /** In-app link to the new session. */
    href: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(RABBIT_HOLE_CREATE_FAILURE_REASONS),
    /** Plain-language explanation for the user and the model. */
    message: z.string(),
    /** ISO time a rabbit hole can be created again (rate limit only). */
    retryAt: z.string().optional(),
    /** Which cap was hit (rate limit only). */
    limit: z.enum(["minute", "day"]).optional(),
  }),
]);

export type RabbitHoleCreateOutput = z.infer<typeof RabbitHoleCreateOutputSchema>;

/**
 * 24-hour `hh:mm` for a retry time. With no `timeZone` the runtime's zone is used (the user's
 * own clock in the browser). An unknown zone falls back to UTC and says so.
 */
export function formatRetryClock(at: Date | string, timeZone?: string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };

  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(date);
  } catch {
    return `${new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date)} UTC`;
  }
}
