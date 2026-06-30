import type { FeatureHintRegistration } from "./feature-hint-context";
import { isFeatureHintEligibleForContext } from "./feature-hint-eligibility";
import { compareFeatureHintPriority } from "./feature-hint-priority";
import type { FeatureHintId } from "./feature-hints";
import {
  FEATURE_HINT_IDS,
  getFeatureHint,
  isFeatureHintEnabledInCode,
} from "./feature-hints";
import { isFeatureHintHidden, type FeatureHintDismissRecord } from "./feature-hint-storage";

export type FeatureHintQueueContext = {
  hydrated: boolean;
  guideBreathBlocked: boolean;
  pathname: string;
  navigationSettled: boolean;
  registrations: Map<FeatureHintId, FeatureHintRegistration>;
  dismissRecord: FeatureHintDismissRecord;
  replayFeatureHints: boolean;
  sessionDismissedIds: ReadonlySet<FeatureHintId>;
};

export function getEligibleFeatureHintQueue(context: FeatureHintQueueContext): FeatureHintId[] {
  if (!context.hydrated || context.guideBreathBlocked) return [];

  return FEATURE_HINT_IDS.filter((id) => {
    if (!isFeatureHintEnabledInCode(id)) return false;

    const definition = getFeatureHint(id);

    if (
      isFeatureHintHidden(
        context.dismissRecord,
        id,
        definition.version,
        context.replayFeatureHints,
        context.sessionDismissedIds,
        definition.respectDismissInReplay
      )
    ) {
      return false;
    }

    if (
      !isFeatureHintEligibleForContext(id, {
        pathname: context.pathname,
        navigationSettled: context.navigationSettled,
        registrations: context.registrations,
        dismissRecord: context.dismissRecord,
        replayFeatureHints: context.replayFeatureHints,
      })
    ) {
      return false;
    }

    const registration = context.registrations.get(id);

    if (!registration?.showWhen) return false;

    if (definition.presentation === "toast") return true;

    return Boolean(registration.anchorRef.current);
  }).sort(compareFeatureHintPriority);
}

export function featureHintQueuePosition(
  queue: FeatureHintId[],
  activeId: FeatureHintId | null
): { index: number; total: number } | null {
  if (!activeId || queue.length <= 1) return null;

  const index = queue.indexOf(activeId);

  if (index < 0) return null;

  return { index: index + 1, total: queue.length };
}
