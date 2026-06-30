"use client";

import type { FeatureHintId } from "@/lib/onboarding/feature-hints";

import { useCallback, useEffect, useState } from "react";

import {
  dismissFeatureHint,
  isFeatureHintDismissed,
  readFeatureHintDismissRecord,
} from "@/lib/onboarding/feature-hint-storage";
import {
  getFeatureHint,
  isFeatureHintEnabledInCode,
} from "@/lib/onboarding/feature-hints";

export function useFeatureHint(id: FeatureHintId, showWhen = true) {
  const definition = getFeatureHint(id);
  const enabledInCode = isFeatureHintEnabledInCode(id);
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setHydrated(true);
    const record = readFeatureHintDismissRecord(window.localStorage);

    setDismissed(isFeatureHintDismissed(record, id, definition.version));
  }, [definition.version, id]);

  const dismiss = useCallback(() => {
    const next = dismissFeatureHint(window.localStorage, id, definition.version);

    setDismissed(isFeatureHintDismissed(next, id, definition.version));
  }, [definition.version, id]);

  const visible = hydrated && enabledInCode && showWhen && !dismissed;

  return { definition, visible, dismiss, enabledInCode };
}
