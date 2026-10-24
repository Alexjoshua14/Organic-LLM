"use client";

import { useEffect, useState } from "react";

import { isBrowserOnline } from "@/lib/ergon/offline";

/** Tracks `navigator.onLine` for quiet Ergon offline status. */
export function useErgonOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(isBrowserOnline());

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
