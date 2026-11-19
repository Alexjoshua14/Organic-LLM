import type { FeatureTipInstance } from "./feature-tip-registry";

import { AUTO_FEATURE_TIP_IDS, getAutoFeatureTip, isAutoFeatureTipEnabled } from "./feature-tips";
import { isTipSeen, pruneTipLog, type OnboardingState } from "./onboarding-state";
import { TIP_TIMING, type TipTiming } from "./tip-timing";

/**
 * Pure rules for when an automatic tip may appear. The layer feeds in clocks and DOM checks; these
 * functions decide. See `docs/design/onboarding.md` for the reasoning.
 */

export type TipPacingInput = {
  now: number;
  /** When the current route was entered. */
  routeEnteredAt: number;
  /** Last pointer, key, wheel, touch, input or scroll event. */
  lastActivityAt: number;
  documentHidden: boolean;
  /** A tip already appeared during this route visit. */
  shownThisVisit: boolean;
  /** When automatic tips were shown (from the persisted state, shared across tabs). */
  tipLog: readonly number[];
};

export type TipPacingBlock =
  | "settling"
  | "active"
  | "document-hidden"
  | "shown-this-visit"
  | "cooldown"
  | "window-cap";

export function tipPacingBlock(
  input: TipPacingInput,
  timing: TipTiming = TIP_TIMING
): TipPacingBlock | null {
  if (input.documentHidden) return "document-hidden";
  if (input.shownThisVisit) return "shown-this-visit";
  if (input.now - input.routeEnteredAt < timing.settleMs) return "settling";
  if (input.now - input.lastActivityAt < timing.idleMs) return "active";

  const recent = pruneTipLog(input.tipLog, input.now);
  const last = recent.length > 0 ? Math.max(...recent) : null;

  if (last != null && input.now - last < timing.cooldownMs) return "cooldown";
  if (recent.length >= timing.maxPerWindow) return "window-cap";

  return null;
}

export type TipCandidateContext = {
  pathname: string;
  state: OnboardingState;
  sessionHiddenTips: ReadonlySet<string>;
  /** Account is new enough, or onboarding was replayed. */
  autoEligible: boolean;
};

/**
 * Registered instances that may show a tip now, in priority order (registry order of
 * `AUTO_FEATURE_TIP_IDS`, then mount order). DOM presentability is checked separately.
 */
export function selectTipCandidates(
  instances: readonly FeatureTipInstance[],
  context: TipCandidateContext
): FeatureTipInstance[] {
  if (!context.autoEligible || !context.state.tipsEnabled) return [];

  const candidates: FeatureTipInstance[] = [];

  for (const id of AUTO_FEATURE_TIP_IDS) {
    if (!isAutoFeatureTipEnabled(id) || context.sessionHiddenTips.has(id)) continue;

    const tip = getAutoFeatureTip(id);

    if (isTipSeen(context.state, id, tip.version)) continue;
    if (tip.pathPrefix && !context.pathname.startsWith(tip.pathPrefix)) continue;

    for (const instance of instances) {
      if (instance.id === id && instance.showWhen) candidates.push(instance);
    }
  }

  return candidates;
}
