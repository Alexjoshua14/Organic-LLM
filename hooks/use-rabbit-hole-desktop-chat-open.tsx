"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type RabbitHoleDesktopChatOpenContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const RabbitHoleDesktopChatOpenContext =
  createContext<RabbitHoleDesktopChatOpenContextValue | null>(null);

export function RabbitHoleDesktopChatOpenProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey && e.code === "KeyB") {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <RabbitHoleDesktopChatOpenContext.Provider value={value}>
      {children}
    </RabbitHoleDesktopChatOpenContext.Provider>
  );
}

export function useRabbitHoleDesktopChatOpen(): RabbitHoleDesktopChatOpenContextValue {
  const ctx = useContext(RabbitHoleDesktopChatOpenContext);

  if (!ctx) {
    throw new Error("useRabbitHoleDesktopChatOpen must be used within RabbitHoleDesktopChatOpenProvider");
  }

  return ctx;
}

export function useOptionalRabbitHoleDesktopChatOpen(): RabbitHoleDesktopChatOpenContextValue | null {
  return useContext(RabbitHoleDesktopChatOpenContext);
}
