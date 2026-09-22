import { z } from "zod";

/**
 * What the user currently has open, as the client reports it.
 *
 * Deliberately a *descriptor*, not the content: surfaces register an id and the server assembles
 * the body from canonical sources (thread summary, compiled Strata doc, rabbit-hole graph). That
 * keeps decryption, ownership checks, and the token budget on the server, and keeps the payload
 * the client sends to a few dozen bytes.
 *
 * Client-safe: `useVoiceScreenContext` builds it, `/api/ai/speak/realtime/context` validates it.
 */
export const SpeakScreenSurfaceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("chat"),
    /** `threads.id` — resolved to its rolling summary. */
    id: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("stratum"),
    /** `strata_pages.id` — resolved to the compiled document. */
    id: z.string().min(1).max(128),
  }),
  z.object({
    kind: z.literal("rabbit-hole"),
    /** `rabbit_hole_sessions.session_id` — resolved to node summaries plus graph shape. */
    id: z.string().uuid(),
    /** Node the user is reading, when the session has one focused. */
    activeNodeId: z.string().min(1).max(128).optional().nullable(),
  }),
  /** The user navigated somewhere with no registered context; tells the model to let it go stale. */
  z.object({ kind: z.literal("none") }),
]);

export type SpeakScreenSurface = z.infer<typeof SpeakScreenSurfaceSchema>;

export const SpeakScreenContextBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  surface: SpeakScreenSurfaceSchema,
});

export type SpeakScreenContextBody = z.infer<typeof SpeakScreenContextBodySchema>;

/**
 * Stable identity for a surface. The provider only asks the server to rebuild when this
 * changes, so navigating away and back within the same session costs nothing.
 */
export function screenSurfaceKey(surface: SpeakScreenSurface): string {
  switch (surface.kind) {
    case "chat":
      return `chat:${surface.id}`;
    case "stratum":
      return `stratum:${surface.id}`;
    case "rabbit-hole":
      return `rabbit-hole:${surface.id}:${surface.activeNodeId ?? "root"}`;
    case "none":
      return "none";
  }
}
