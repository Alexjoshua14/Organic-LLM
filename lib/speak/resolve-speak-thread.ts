import "server-only";

import type { SpeakThreadPolicy } from "@/lib/schemas/speak-thread";

import {
  createChat,
  getLatestThreadByFeature,
  getThreadOwnerContext,
  updateThreadRouting,
} from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/speak/resolve-speak-thread.ts");

/** `threads.feature` for voice conversations; keeps them out of the main sidebar list. */
export const SPEAK_THREAD_FEATURE = "speak";
export const SPEAK_THREAD_PATH = "/speak";

export type SpeakThreadResolution = {
  threadId: string | null;
  /** True when the session continues an existing thread rather than a freshly created one. */
  resumed: boolean;
  title: string | null;
  error?: string;
};

/**
 * Injected so tests do not register process-wide module mocks for the data layer
 * (same reasoning as `lib/spatial-artifacts/sync/cron-sync-handler.ts`).
 */
export type ResolveSpeakThreadDeps = {
  getLatestThreadByFeature: typeof getLatestThreadByFeature;
  getThreadOwnerContext: typeof getThreadOwnerContext;
  createChat: typeof createChat;
  updateThreadRouting: typeof updateThreadRouting;
};

const defaultDeps: ResolveSpeakThreadDeps = {
  getLatestThreadByFeature,
  getThreadOwnerContext,
  createChat,
  updateThreadRouting,
};

export async function resolveSpeakThread(
  args: {
    ownerId: string;
    policy: SpeakThreadPolicy;
    /** Explicit thread from the client; honoured only when the caller owns it. */
    requestedThreadId?: string | null;
  },
  deps: ResolveSpeakThreadDeps = defaultDeps
): Promise<SpeakThreadResolution> {
  if (args.requestedThreadId) {
    const owner = await deps.getThreadOwnerContext(args.requestedThreadId);

    if (!owner.error && owner.data?.ownerId === args.ownerId) {
      return { threadId: args.requestedThreadId, resumed: true, title: null };
    }

    logger.warn("resolveSpeakThread", "Requested thread not owned by caller; ignoring");
  }

  if (args.policy === "resume-latest") {
    const latest = await deps.getLatestThreadByFeature(args.ownerId, SPEAK_THREAD_FEATURE);

    if (!latest.error && latest.data) {
      return { threadId: latest.data.id, resumed: true, title: latest.data.title ?? null };
    }
  }

  const created = await deps.createChat();

  if (created.error || !created.data) {
    // Voice still starts without a thread, as before; persistence and nanobots no-op.
    return {
      threadId: null,
      resumed: false,
      title: null,
      error: created.error?.message ?? "Failed to create speak thread",
    };
  }

  const routing = await deps.updateThreadRouting(created.data, {
    feature: SPEAK_THREAD_FEATURE,
    path: SPEAK_THREAD_PATH,
  });

  if (!routing.ok) {
    // An untagged thread is still usable this session; it just will not be resumed next time.
    logger.warn("resolveSpeakThread", `Failed to tag speak thread: ${routing.error?.message}`);
  }

  return { threadId: created.data, resumed: false, title: null };
}
