"use client";

import { createContext, useContext, type ReactNode } from "react";

type ErgonChromeContextValue = {
  liquidChromeEnabled: boolean;
};

const ErgonChromeContext = createContext<ErgonChromeContextValue | null>(null);

type ErgonChromeProviderProps = {
  liquidChromeEnabled: boolean;
  children: ReactNode;
};

export function ErgonChromeProvider({ liquidChromeEnabled, children }: ErgonChromeProviderProps) {
  return (
    <ErgonChromeContext.Provider value={{ liquidChromeEnabled }}>
      {children}
    </ErgonChromeContext.Provider>
  );
}

export function useErgonChromeSeed(): boolean {
  const ctx = useContext(ErgonChromeContext);

  if (ctx == null) {
    throw new Error("useErgonChromeSeed must be used within ErgonChromeProvider");
  }

  return ctx.liquidChromeEnabled;
}
