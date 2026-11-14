import { z } from "zod";

/**
 * Client-safe contracts for the Arcadia Jev-mode `voice_reply` tool. The server tool lives in
 * `lib/llm/voice-reply-tool.ts`; the chat UI parses its persisted output with the schemas here.
 * Rabbit hole creation is the shared rabbit hole toolset (`lib/llm/rabbit-hole-toolset`).
 */

export const VOICE_REPLY_TOOL_NAME = "voice_reply";

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
