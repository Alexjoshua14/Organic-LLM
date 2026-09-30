import "server-only";

import {
  createChat,
  getLatestThreadByFeature,
  getThreadOwnerContext,
  updateThreadRouting,
} from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/resolve-feature-thread.ts");

export type FeatureThreadPolicy = "resume-latest" | "new";

export type FeatureThreadResolution = {
  threadId: string | null;
  /** True when the session continues an existing thread rather than a freshly created one. */
  resumed: boolean;
  title: string | null;
  error?: string;
};

/**
 * Injected so tests do not register process-wide module mocks for the data layer
 * (same reasoning as Speak's resolver and the spatial-artifacts cron sync handler).
 */
export type ResolveFeatureThreadDeps = {
  getLatestThreadByFeature: typeof getLatestThreadByFeature;
  getThreadOwnerContext: typeof getThreadOwnerContext;
  createChat: typeof createChat;
  updateThreadRouting: typeof updateThreadRouting;
};

const defaultDeps: ResolveFeatureThreadDeps = {
  getLatestThreadByFeature,
  getThreadOwnerContext,
  createChat,
  updateThreadRouting,
};

/**
 * Resolves a feature-tagged thread: resume the newest matching thread, honour an owned
 * explicit id, or create and tag a new one. Feature tags keep these threads out of the
 * main sidebar list (Speak, Aion presence, Remy planner, …).
 */
export async function resolveFeatureThread(
  args: {
    ownerId: string;
    feature: string;
    path: string;
    policy: FeatureThreadPolicy;
    /** Explicit thread from the client; honoured only when the caller owns it. */
    requestedThreadId?: string | null;
  },
  deps: ResolveFeatureThreadDeps = defaultDeps
): Promise<FeatureThreadResolution> {
  if (args.requestedThreadId) {
    const owner = await deps.getThreadOwnerContext(args.requestedThreadId);

    if (!owner.error && owner.data?.ownerId === args.ownerId) {
      return { threadId: args.requestedThreadId, resumed: true, title: null };
    }

    logger.warn("resolveFeatureThread", "Requested thread not owned by caller; ignoring");
  }

  if (args.policy === "resume-latest") {
    const latest = await deps.getLatestThreadByFeature(args.ownerId, args.feature);

    if (!latest.error && latest.data) {
      return { threadId: latest.data.id, resumed: true, title: latest.data.title ?? null };
    }
  }

  const created = await deps.createChat();

  if (created.error || !created.data) {
    return {
      threadId: null,
      resumed: false,
      title: null,
      error: created.error?.message ?? "Failed to create feature thread",
    };
  }

  const routing = await deps.updateThreadRouting(created.data, {
    feature: args.feature,
    path: args.path,
  });

  if (!routing.ok) {
    logger.warn(
      "resolveFeatureThread",
      `Failed to tag feature thread (${args.feature}): ${routing.error?.message}`
    );
  }

  return { threadId: created.data, resumed: false, title: null };
}
