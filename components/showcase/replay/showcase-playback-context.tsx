"use client";

import type { ReactNode } from "react";

import { createContext, useContext } from "react";

/**
 * How embedded demos behave. "standalone" (default) opens on a settled, inspectable frame
 * and owns the page's keyboard shortcuts. "narrated" is for a demo inside a longer story:
 * it plays from the start when scrolled into view, and leaves the keyboard alone so several
 * demos can share one page.
 */
export type ShowcasePlaybackMode = "standalone" | "narrated";

const ShowcasePlaybackContext = createContext<ShowcasePlaybackMode>("standalone");

export function ShowcasePlaybackProvider({
  mode,
  children,
}: {
  mode: ShowcasePlaybackMode;
  children: ReactNode;
}) {
  return (
    <ShowcasePlaybackContext.Provider value={mode}>{children}</ShowcasePlaybackContext.Provider>
  );
}

export function useShowcasePlaybackMode(): ShowcasePlaybackMode {
  return useContext(ShowcasePlaybackContext);
}
