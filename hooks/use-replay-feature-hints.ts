"use client";

import { useEffect, useState } from "react";

import { getSettings } from "@/lib/user-settings";

/** Quick-settings toggle: show dismissed feature hints again until turned off. */
export function useReplayFeatureHints(): boolean {
  const [enabled, setEnabled] = useState(() => getSettings().replayFeatureHints);

  useEffect(() => {
    const sync = () => setEnabled(getSettings().replayFeatureHints);

    sync();
    window.addEventListener("organic-llm-settings", sync);

    return () => window.removeEventListener("organic-llm-settings", sync);
  }, []);

  return enabled;
}
