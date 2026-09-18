import { z } from "zod";

import { ContextEffortLevelSchema, DEFAULT_CONTEXT_EFFORT } from "@/lib/memory/context-effort";

/**
 * Client-side user settings schema.
 * Persisted to localStorage always (quick cache); Supabase grabbers can sync when configured.
 */
export const UserSettingsSchema = z.object({
  fontId: z.string().default("satoshi"),
  /** When true, TTS plays the whole message; when false, only the first section (paragraph). Dev-only setting under Advanced. */
  ttsWholeMessage: z.boolean().default(true),
  /** When true, no chat data is retained (zero data retention). */
  zeroDataRetention: z.boolean().default(false),
  /** When true, show threads from all features in the main sidebar list. */
  coalescenceMode: z.boolean().default(false),
  /** Experimental: Arcadia composer can show a markdown preview toggle. */
  experimentalArcadiaMarkdownPreview: z.boolean().default(false),
  /** Beta: Arcadia composer shows a context-effort slider (Instant / Quick / Heavy). */
  experimentalContextEffort: z.boolean().default(false),
  /** Last chosen Arcadia context-effort tier (used when the beta control is on). */
  contextEffortLevel: ContextEffortLevelSchema.default(DEFAULT_CONTEXT_EFFORT),
  /** Ergon page: animated liquid chrome background. */
  ergonLiquidChrome: z.boolean().default(true),
  /** When true, show feature hints/coachmarks again (ignores persisted dismissals until turned off). */
  replayFeatureHints: z.boolean().default(false),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const defaultUserSettings = (): UserSettings => ({
  fontId: "satoshi",
  ttsWholeMessage: true,
  zeroDataRetention: false,
  coalescenceMode: false,
  experimentalArcadiaMarkdownPreview: false,
  experimentalContextEffort: false,
  contextEffortLevel: DEFAULT_CONTEXT_EFFORT,
  ergonLiquidChrome: true,
  replayFeatureHints: false,
});
