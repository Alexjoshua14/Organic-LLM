import { z } from "zod";

/**
 * Client-side user settings schema.
 * Persisted to localStorage always (quick cache); Supabase grabbers can sync when configured.
 */
export const UserSettingsSchema = z.object({
  fontId: z.string().default("satoshi"),
  /** When true, TTS plays the whole message; when false, only the first section (paragraph). Dev-only setting under Advanced. */
  ttsWholeMessage: z.boolean().default(true),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const defaultUserSettings = (): UserSettings => ({
  fontId: "satoshi",
  ttsWholeMessage: true,
});
