"use client";

import { useEffect, useState } from "react";

import { getSettings } from "@/lib/user-settings";

/** Reactive Coalescence Mode — spatial artifacts and sidebar coalescence share this flag. */
export function useCoalescenceMode(): boolean {
  const [enabled, setEnabled] = useState(() => getSettings().coalescenceMode);

  useEffect(() => {
    const sync = () => setEnabled(getSettings().coalescenceMode);

    sync();
    window.addEventListener("organic-llm-settings", sync);

    return () => window.removeEventListener("organic-llm-settings", sync);
  }, []);

  return enabled;
}
