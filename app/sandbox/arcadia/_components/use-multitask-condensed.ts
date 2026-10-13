"use client";

import { useEffect, useState } from "react";

import { MULTITASK_DASHBOARD_WIDE_MIN_PX } from "@/lib/arcadia/multitask/layout-mode";

/** True below the wide dashboard split — the condensed (phone / narrow window) layout. */
export function useMultitaskCondensed(): boolean {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MULTITASK_DASHBOARD_WIDE_MIN_PX - 1}px)`);
    const sync = () => setCondensed(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  return condensed;
}
