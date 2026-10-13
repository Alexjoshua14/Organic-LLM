import "server-only";

import type { SpeakThreadPolicy } from "@/lib/schemas/speak-thread";

import {
  resolveFeatureThread,
  type FeatureThreadResolution,
  type ResolveFeatureThreadDeps,
} from "@/lib/chat/resolve-feature-thread";

/** `threads.feature` for voice conversations; keeps them out of the main sidebar list. */
export const SPEAK_THREAD_FEATURE = "speak";
export const SPEAK_THREAD_PATH = "/speak";

export type SpeakThreadResolution = FeatureThreadResolution;

export type ResolveSpeakThreadDeps = ResolveFeatureThreadDeps;

/**
 * Thin Speak wrapper around {@link resolveFeatureThread}. The feature tag and path stay
 * Speak-owned so existing tests and call sites keep working.
 */
export async function resolveSpeakThread(
  args: {
    ownerId: string;
    policy: SpeakThreadPolicy;
    requestedThreadId?: string | null;
  },
  deps?: ResolveSpeakThreadDeps
): Promise<SpeakThreadResolution> {
  return resolveFeatureThread(
    {
      ownerId: args.ownerId,
      feature: SPEAK_THREAD_FEATURE,
      path: SPEAK_THREAD_PATH,
      policy: args.policy,
      requestedThreadId: args.requestedThreadId,
    },
    deps
  );
}
