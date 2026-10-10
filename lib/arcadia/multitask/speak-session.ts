/**
 * Single Speak session ownership for Arcadia multitask.
 *
 * Only one subagent may own the live Realtime connection. Starting Speak on
 * another agent ends the current call first, then opens the new one.
 */

export type ArcadiaSpeakSessionPhase = "idle" | "closing" | "connecting" | "live";

/**
 * Which agent owns the Speak glass bar. Binding is set before connect so the
 * bar can morph through the disconnect→connect gap; cleared only when idle.
 */
export function resolveLiveSpeakAgentId(args: {
  speakBindingAgentId: string | null | undefined;
}): string | null {
  const id = args.speakBindingAgentId?.trim();

  return id || null;
}

/**
 * Plan a Speak handoff. At most one live target; a different next agent ends the first.
 */
export function planSpeakHandoff(args: { liveAgentId: string | null; nextAgentId: string }): {
  endCurrent: boolean;
  outgoingAgentId: string | null;
  incomingAgentId: string;
} {
  const next = args.nextAgentId.trim();
  const live = args.liveAgentId?.trim() || null;

  if (live && live !== next) {
    return { endCurrent: true, outgoingAgentId: live, incomingAgentId: next };
  }

  return { endCurrent: false, outgoingAgentId: null, incomingAgentId: next };
}

/**
 * Visual phase for one agent's glass Speak bar.
 * `closingAgentId` is the previous live target during a brief handoff exit.
 */
export function resolveSpeakBarPhase(args: {
  agentId: string;
  liveAgentId: string | null;
  closingAgentId: string | null;
  voiceConnecting: boolean;
  voiceConnected: boolean;
}): ArcadiaSpeakSessionPhase {
  if (args.closingAgentId === args.agentId && args.liveAgentId !== args.agentId) {
    return "closing";
  }
  if (args.liveAgentId !== args.agentId) return "idle";
  if (args.voiceConnected) return "live";
  if (args.voiceConnecting) return "connecting";

  // Binding set, voice not up yet (handoff gap or first click) — still morphing in.
  return "connecting";
}

/** At most one agent may be in connecting/live at a time. */
export function assertSingleLiveSpeakTarget(
  phases: ReadonlyArray<{ agentId: string; phase: ArcadiaSpeakSessionPhase }>
): string | null {
  const live = phases.filter((p) => p.phase === "connecting" || p.phase === "live");

  if (live.length <= 1) return live[0]?.agentId ?? null;

  throw new Error(
    `Expected at most one live Speak target, got ${live.map((p) => p.agentId).join(", ")}`
  );
}
