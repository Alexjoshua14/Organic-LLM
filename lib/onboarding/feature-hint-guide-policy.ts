/**
 * Organic LLM coachmark pacing policy (hard rule).
 *
 * Do not auto-chain more than {@link MAX_CONSECUTIVE_AUTO_FEATURE_HINTS} coachmarks
 * without unobstructed UI time. After the limit, pause until the user interacts with
 * real UI or explicitly requests guides.
 *
 * Exceptions:
 * - Beginning: first-session sheet / welcome flows are not coachmarks and do not count.
 * - Explicit request: replay tips (settings), Help → "Show next tip", opening first-steps guide.
 */

export const MAX_CONSECUTIVE_AUTO_FEATURE_HINTS = 4;

export const FEATURE_HINT_GUIDE_POLICY = {
  maxConsecutiveAutoHints: MAX_CONSECUTIVE_AUTO_FEATURE_HINTS,
  storageKey: "organic-llm-feature-hint-session",
  sessionDismissedStorageKey: "organic-llm-feature-hint-session-dismissed",
} as const;

export type FeatureHintSessionState = {
  /** Coachmarks dismissed back-to-back on the current surface without a breath break. */
  consecutiveAutoDismissCount: number;
  /** When true, auto coachmarks are paused until UI interaction or explicit request. */
  breathPaused: boolean;
  /** Coarse route bucket — counter resets when this changes (natural break on navigation). */
  surfaceKey: string;
  /** True for the browser session if the user had never dismissed a hint before this session. */
  isBeginningSession: boolean;
};

export function createInitialFeatureHintSessionState(
  surfaceKey: string,
  hasPersistedDismissals: boolean
): FeatureHintSessionState {
  return {
    consecutiveAutoDismissCount: 0,
    breathPaused: false,
    surfaceKey,
    isBeginningSession: !hasPersistedDismissals,
  };
}

export function shouldEnterGuideBreathPause(
  consecutiveAutoDismissCount: number,
  options: { isBeginningSession: boolean }
): boolean {
  if (options.isBeginningSession) {
    // Beginning exception: first-ever session may finish the opening burst without a forced pause.
    // Still capped at MAX while on one surface — navigation resets the counter.
    return false;
  }

  return consecutiveAutoDismissCount >= MAX_CONSECUTIVE_AUTO_FEATURE_HINTS;
}

export function shouldBlockAutoFeatureHints(
  session: FeatureHintSessionState,
  options: {
    replayFeatureHints: boolean;
    explicitGuideRequested: boolean;
  }
): boolean {
  if (options.replayFeatureHints) return false;
  if (options.explicitGuideRequested) return false;

  return session.breathPaused;
}

export function recordAutoFeatureHintDismissed(
  session: FeatureHintSessionState
): FeatureHintSessionState {
  const consecutiveAutoDismissCount = session.consecutiveAutoDismissCount + 1;
  const breathPaused = shouldEnterGuideBreathPause(consecutiveAutoDismissCount, {
    isBeginningSession: session.isBeginningSession,
  });

  return {
    ...session,
    consecutiveAutoDismissCount,
    breathPaused,
  };
}

export function clearFeatureHintGuideBreath(
  session: FeatureHintSessionState
): FeatureHintSessionState {
  return {
    ...session,
    consecutiveAutoDismissCount: 0,
    breathPaused: false,
    isBeginningSession: false,
  };
}

export function syncFeatureHintSessionSurface(
  session: FeatureHintSessionState,
  surfaceKey: string
): FeatureHintSessionState {
  if (session.surfaceKey === surfaceKey) return session;

  return clearFeatureHintGuideBreath({
    ...session,
    surfaceKey,
  });
}

/** Coarse buckets so navigating surfaces gives a natural breath between guide bursts. */
export function featureHintSurfaceKey(pathname: string): string {
  if (pathname.startsWith("/sandbox/arcadia")) return "arcadia";
  if (pathname.startsWith("/sandbox/topic-explore")) return "noesis";
  if (pathname.startsWith("/rabbitholes")) return "rabbit-holes";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/remy")) return "remy";
  if (pathname.startsWith("/ergon")) return "ergon";

  const parts = pathname.split("/").filter(Boolean);

  return parts.slice(0, 2).join("/") || "home";
}
