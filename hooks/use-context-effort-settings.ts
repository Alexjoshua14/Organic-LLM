"use client";

import { useEffect, useState } from "react";

import { DEFAULT_CONTEXT_EFFORT, type ContextEffortLevel } from "@/lib/memory/context-effort";
import { getSettings } from "@/lib/user-settings";

export type ContextEffortSettings = {
  enabled: boolean;
  level: ContextEffortLevel;
};

/** Reactive beta flag + last chosen Arcadia context-effort tier. */
export function useContextEffortSettings(): ContextEffortSettings {
  const [enabled, setEnabled] = useState(() => getSettings().experimentalContextEffort);
  const [level, setLevel] = useState<ContextEffortLevel>(
    () => getSettings().contextEffortLevel ?? DEFAULT_CONTEXT_EFFORT
  );

  useEffect(() => {
    const sync = () => {
      const settings = getSettings();

      setEnabled(settings.experimentalContextEffort);
      setLevel(settings.contextEffortLevel ?? DEFAULT_CONTEXT_EFFORT);
    };

    sync();
    window.addEventListener("organic-llm-settings", sync);

    return () => window.removeEventListener("organic-llm-settings", sync);
  }, []);

  return { enabled, level };
}
