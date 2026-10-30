"use client";

import { useEffect, useState } from "react";

import { DEFAULT_CONTEXT_EFFORT, type ContextEffortLevel } from "@/lib/memory/context-effort";
import { useHydrated } from "@/hooks/use-hydrated";
import { getSettings } from "@/lib/user-settings";

export type ContextEffortSettings = {
  enabled: boolean;
  level: ContextEffortLevel;
};

/** Reactive beta flag + last chosen Arcadia context-effort tier. */
export function useContextEffortSettings(initial?: ContextEffortSettings): ContextEffortSettings {
  const hydrated = useHydrated();
  // Client navigation can read immediately; hydration must match the request seed.
  const [enabled, setEnabled] = useState(() =>
    hydrated ? getSettings().experimentalContextEffort : (initial?.enabled ?? false)
  );
  const [level, setLevel] = useState<ContextEffortLevel>(() =>
    hydrated ? getSettings().contextEffortLevel : (initial?.level ?? DEFAULT_CONTEXT_EFFORT)
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
