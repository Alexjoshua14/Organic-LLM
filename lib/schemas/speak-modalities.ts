import { z } from "zod";

/** User ceiling for speak Live output channels. Voice is always on for Realtime. */
export const SpeakModalitiesSchema = z.object({
  text: z.boolean().default(true),
  genUi: z.boolean().default(false),
  web: z.boolean().default(false),
});

export type SpeakModalities = z.infer<typeof SpeakModalitiesSchema>;

export const DEFAULT_SPEAK_MODALITIES: SpeakModalities = {
  text: true,
  genUi: false,
  web: false,
};
