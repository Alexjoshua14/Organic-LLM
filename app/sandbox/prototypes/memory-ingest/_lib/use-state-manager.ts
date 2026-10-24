"use client";

import type { StateName } from "./lens/fieldLibrary";

import { useLayoutEffect, useRef, type MutableRefObject } from "react";

import { StateManager } from "./lens/state-manager";

export function useStateManager(state: StateName): MutableRefObject<StateManager> {
  const mgr = useRef<StateManager | null>(null);

  if (mgr.current === null) {
    mgr.current = new StateManager(state);
  }

  useLayoutEffect(() => {
    mgr.current!.transitionTo(state, performance.now());
  }, [state]);

  return mgr as MutableRefObject<StateManager>;
}
