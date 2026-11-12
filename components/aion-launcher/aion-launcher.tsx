"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { isEditableEventTarget } from "@/lib/dom/is-editable-event-target";

/**
 * Open state and the ⌘K / Ctrl+K shortcut for the launcher. The surface itself lives in
 * `launcher-surface.tsx` and is mounted deeper in the tree, where the voice and sidebar
 * providers it reads are available.
 */

type AionLauncherContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const AionLauncherContext = createContext<AionLauncherContextValue | null>(null);

export function useAionLauncher(): AionLauncherContextValue {
  const ctx = useContext(AionLauncherContext);

  if (!ctx) {
    throw new Error("useAionLauncher must be used within AionLauncherProvider");
  }

  return ctx;
}

export function AionLauncherProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K";

      if (!isK || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;

      // Typing in a field keeps its own ⌘K, but the launcher's own input must still close it.
      if (!open && isEditableEventTarget(e.target)) return;

      e.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, toggle]);

  return <AionLauncherContext.Provider value={value}>{children}</AionLauncherContext.Provider>;
}
