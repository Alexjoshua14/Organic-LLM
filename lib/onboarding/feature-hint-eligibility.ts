import type { FeatureHintId } from "./feature-hints";
import type { FeatureHintRegistration } from "./feature-hint-context";

import { getFeatureHint, isFeatureHintEnabledInCode } from "./feature-hints";
import { isFeatureHintHidden, type FeatureHintDismissRecord } from "./feature-hint-storage";

/** First hint users should see after landing on a surface (blocks generic hints until dismissed). */
export const SURFACE_ENTRY_HINTS: Array<{ pathPrefix: string; hintId: FeatureHintId }> = [
  { pathPrefix: "/sandbox/arcadia", hintId: "arcadia-starters" },
  { pathPrefix: "/sandbox/topic-explore", hintId: "noesis-sparks" },
  { pathPrefix: "/rabbitholes", hintId: "rabbit-holes-focus" },
];

/** Generic hints that should not compete with a pending surface entry hint after navigation. */
export const GLOBAL_HINTS_DEFERRED_ON_SURFACE: FeatureHintId[] = [
  "experience-rail",
  "composer-search-memory",
  "composer-auto-model",
];

export function getSurfaceEntryHintForPath(pathname: string): FeatureHintId | null {
  for (const entry of SURFACE_ENTRY_HINTS) {
    if (pathname.startsWith(entry.pathPrefix)) {
      return entry.hintId;
    }
  }

  return null;
}

export function isRegistrationEligible(
  hintId: FeatureHintId,
  registrations: Map<FeatureHintId, FeatureHintRegistration>
): boolean {
  const registration = registrations.get(hintId);

  if (!registration?.showWhen) return false;

  const definition = getFeatureHint(hintId);

  if (definition.presentation === "toast") return true;

  return Boolean(registration.anchorRef.current);
}

export function isSurfaceEntryHintPending(
  pathname: string,
  registrations: Map<FeatureHintId, FeatureHintRegistration>,
  dismissRecord: FeatureHintDismissRecord,
  replayFeatureHints: boolean
): boolean {
  const hintId = getSurfaceEntryHintForPath(pathname);

  if (!hintId || !isFeatureHintEnabledInCode(hintId)) return false;

  const definition = getFeatureHint(hintId);

  if (
    isFeatureHintHidden(
      dismissRecord,
      hintId,
      definition.version,
      replayFeatureHints,
      undefined,
      definition.respectDismissInReplay
    )
  ) {
    return false;
  }

  return isRegistrationEligible(hintId, registrations);
}

export function isFeatureHintEligibleForContext(
  hintId: FeatureHintId,
  context: {
    pathname: string;
    navigationSettled: boolean;
    registrations: Map<FeatureHintId, FeatureHintRegistration>;
    dismissRecord: FeatureHintDismissRecord;
    replayFeatureHints: boolean;
  }
): boolean {
  const definition = getFeatureHint(hintId);

  if (definition.pathPrefix && !context.pathname.startsWith(definition.pathPrefix)) {
    return false;
  }

  if (definition.deferUntilNavigationSettled && !context.navigationSettled) {
    return false;
  }

  if (
    isSurfaceEntryHintPending(
      context.pathname,
      context.registrations,
      context.dismissRecord,
      context.replayFeatureHints
    ) &&
    GLOBAL_HINTS_DEFERRED_ON_SURFACE.includes(hintId)
  ) {
    return false;
  }

  return true;
}
