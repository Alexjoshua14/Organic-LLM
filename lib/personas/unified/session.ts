import { z } from "zod";

import { PaintingStateSchema } from "@/lib/personas/domains/acrylic/painting-state";

/**
 * A unified persona session is one project the user works on with one persona, shared by chat
 * and Realtime voice: what they are making, the persona's running picture of the work, and a
 * short log of recent exchanges from both surfaces. Client-safe; storage is in `store.ts`.
 */

export const PersonaIdSchema = z.enum(["artist-assistant"]);
export type PersonaId = z.infer<typeof PersonaIdSchema>;

export const PersonaDomainIdSchema = z.enum(["acrylic-painting"]);
export type PersonaDomainId = z.infer<typeof PersonaDomainIdSchema>;

export const PersonaStarterIdSchema = z.enum(["sci-fi-cinema-eclipse"]);
export type PersonaStarterId = z.infer<typeof PersonaStarterIdSchema>;

export const PersonaSurfaceSchema = z.enum(["chat", "voice"]);
export type PersonaSurface = z.infer<typeof PersonaSurfaceSchema>;

/**
 * Where the persona is switched on. Chat threads use `chat:<threadId>`; Speak uses
 * {@link SPEAK_PERSONA_SCOPE}. Active on/off is per scope so enabling in one chat does not
 * follow the user into another. The painting project (`latest`) stays shared to resume.
 */
export const PersonaScopeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9:_-]+$/);
export type PersonaScopeId = z.infer<typeof PersonaScopeIdSchema>;

/** Speak page / voice surface — one scope for the whole Speak experience in v0. */
export const SPEAK_PERSONA_SCOPE = "speak" as const;

export function chatPersonaScope(threadId: string): PersonaScopeId {
  return `chat:${threadId}`;
}

export const PERSONA_LOG_MAX = 24;
export const PERSONA_LOG_TEXT_MAX = 1200;
export const PERSONA_SUBJECT_MAX = 2000;

export const PersonaLogEntrySchema = z.object({
  at: z.iso.datetime(),
  surface: PersonaSurfaceSchema,
  role: z.enum(["user", "assistant"]),
  text: z.string().max(PERSONA_LOG_TEXT_MAX),
  /** A user turn the gate heard and chose not to answer. */
  held: z.boolean().optional(),
});

export type PersonaLogEntry = z.infer<typeof PersonaLogEntrySchema>;

export const PersonaSessionSchema = z.object({
  id: z.uuid(),
  personaId: PersonaIdSchema,
  domainId: PersonaDomainIdSchema,
  starterId: PersonaStarterIdSchema.nullable(),
  subject: z.string().max(PERSONA_SUBJECT_MAX),
  /** The persona's picture of the work in progress, from the user's photos. */
  work: PaintingStateSchema.nullable(),
  log: z.array(PersonaLogEntrySchema).max(PERSONA_LOG_MAX),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type PersonaSession = z.infer<typeof PersonaSessionSchema>;

/** What the gate decided an utterance was. */
export const UtteranceKindSchema = z.enum([
  "question",
  "request",
  "answer",
  "correction",
  "greeting",
  "rhetorical",
  "self_talk",
  "narration",
  "acknowledgment",
  "filler",
  "noise",
  "silence_request",
  "incomplete",
  "photo",
]);

export type UtteranceKind = z.infer<typeof UtteranceKindSchema>;

export const PersonaReceiptSchema = z.object({
  /** The user message the receipt is for; voice receipts have none. */
  messageId: z.string().max(200).nullable(),
  disposition: z.enum(["respond", "hold"]),
  kind: UtteranceKindSchema,
  label: z.string().max(60),
});

export type PersonaReceipt = z.infer<typeof PersonaReceiptSchema>;

/** Short, calm receipt copy. Every utterance gets one, answered or not. */
export function receiptLabel(respond: boolean, kind: UtteranceKind): string {
  if (respond) return "Heard";
  switch (kind) {
    case "photo":
      return "Photo noted";
    case "silence_request":
      return "Quiet until you need me";
    case "acknowledgment":
      return "Noted";
    default:
      return "Heard";
  }
}
