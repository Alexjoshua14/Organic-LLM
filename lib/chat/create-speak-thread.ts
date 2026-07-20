import { createChat } from "@/lib/chat/chat-store";
import { getLatestSpeakThread, updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/create-speak-thread.ts");

/** Feature tag for Speak (voice) threads. */
export const SPEAK_FEATURE = "speak";

export type GetOrCreateSpeakThreadResult =
  | { ok: true; id: string; updatedAt: string | null; resumed: boolean }
  | { ok: false; error: string };

/**
 * Resolves the dedicated Speak thread for `(owner, voice)`, creating it on first
 * use. Each voice keeps one persistent thread so the Realtime agent behaves like
 * an "aware AI" that resumes where it left off. Mirrors
 * {@link createMemoryIngestThread}: `createChat` + `updateThreadRouting`, tagging
 * `feature = "speak"` and storing the voice id in `persona`.
 *
 * `updatedAt` is the resumed thread's last-active timestamp (null when freshly
 * created), used downstream for conversational time-awareness.
 */
export async function getOrCreateSpeakThread(
  ownerId: string,
  voiceId: string
): Promise<GetOrCreateSpeakThreadResult> {
  const existing = await getLatestSpeakThread(ownerId, voiceId);

  if (existing.error) {
    logger.error("getOrCreateSpeakThread", existing.error.message);

    return { ok: false, error: existing.error.message };
  }

  if (existing.data) {
    return { ok: true, id: existing.data.id, updatedAt: existing.data.updatedAt, resumed: true };
  }

  const created = await createChat();

  if (created.error || created.data === null) {
    logger.error("getOrCreateSpeakThread", created.error?.message ?? "createChat failed");

    return { ok: false, error: created.error?.message ?? "Failed to create chat" };
  }

  const id = created.data;
  const routingRes = await updateThreadRouting(id, {
    feature: SPEAK_FEATURE,
    persona: voiceId,
    path: "/speak",
  });

  if (!routingRes.ok) {
    logger.error("getOrCreateSpeakThread", "updateThreadRouting failed");

    return { ok: false, error: "Failed to set Speak routing" };
  }

  return { ok: true, id, updatedAt: null, resumed: false };
}
