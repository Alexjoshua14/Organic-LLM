import type { AionEvent, AionTurnTier } from "@/lib/schemas/aion-presence";

/**
 * Timing constants live next to the effect (design backbone principle 4).
 * Approved ranges: debounce short enough that a deliberate click still feels
 * live; coalesce window long enough to absorb a burst of identical clicks.
 */
export const AION_EVENT_DEBOUNCE_MS = 250;

export const AION_COALESCE_WINDOW_MS = 1_200;

/** No server calls after this idle period until the next wake event. */
export const AION_IDLE_DORMANT_MS = 5 * 60_000;

/** Max Tier-0 ledger entries retained client-side for the next real turn. */
export const AION_LEDGER_MAX = 20;

export type TurnPolicySettings = {
  /** When true, presence micro-turns are allowed. */
  enabled: boolean;
  /** Milliseconds since the last successful micro/full turn (or mount). */
  idleMs: number;
  /** Milliseconds since the last event with the same coalesce key (0 if none). */
  msSinceSameCoalesceKey: number;
  /** Whether a micro-turn is already in flight. */
  busy: boolean;
};

export type TurnPolicyDecision = {
  tier: AionTurnTier;
  /** Events with the same key inside the coalesce window collapse into one. */
  coalesceKey: string;
  /** Delay before firing a micro-turn (debounce). 0 for immediate / none. */
  delayMs: number;
  reason: string;
};

function coalesceKeyFor(event: AionEvent): string {
  return `${event.kind}:${event.surface}:${event.label}`;
}

/**
 * Pure policy: decide whether an event costs an LLM turn.
 *
 * - `message` / explicit asks → full
 * - most UI events → micro (after debounce), or none when coalesced / dormant / busy
 * - hover-like system noise stays none (ledger only)
 */
export function decideAionTurnTier(
  event: AionEvent,
  settings: TurnPolicySettings
): TurnPolicyDecision {
  const coalesceKey = coalesceKeyFor(event);

  if (!settings.enabled) {
    return { tier: "none", coalesceKey, delayMs: 0, reason: "disabled" };
  }

  if (event.kind === "message") {
    return { tier: "full", coalesceKey, delayMs: 0, reason: "user-message" };
  }

  // Transient noise: ledger only. The next real turn still sees these.
  if (event.kind === "system" && /hover|scroll|focus|blur/i.test(event.label)) {
    return { tier: "none", coalesceKey, delayMs: 0, reason: "transient-noise" };
  }

  if (settings.idleMs >= AION_IDLE_DORMANT_MS) {
    // First event after dormancy wakes the orb and goes micro so Aion feels present again.
    return {
      tier: "micro",
      coalesceKey,
      delayMs: AION_EVENT_DEBOUNCE_MS,
      reason: "wake-from-dormant",
    };
  }

  if (settings.busy) {
    return { tier: "none", coalesceKey, delayMs: 0, reason: "busy" };
  }

  if (
    settings.msSinceSameCoalesceKey > 0 &&
    settings.msSinceSameCoalesceKey < AION_COALESCE_WINDOW_MS
  ) {
    return { tier: "none", coalesceKey, delayMs: 0, reason: "coalesced" };
  }

  return {
    tier: "micro",
    coalesceKey,
    delayMs: AION_EVENT_DEBOUNCE_MS,
    reason: "ui-event",
  };
}
