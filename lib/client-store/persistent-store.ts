"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny dependency-free external store with optional localStorage persistence.
 *
 * Designed as a thin, swappable interface: callers use `getState`/`setState`/`useStore`,
 * so a future v2 can replace the localStorage backing with a server source without
 * touching consumers.
 */
export type PersistentStore<T> = {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
  /** React hook with a selector. Selector results should be referentially stable across calls. */
  useStore: <S>(selector: (state: T) => S) => S;
};

export function createPersistentStore<T>(storageKey: string, initialState: T): PersistentStore<T> {
  let state = initialState;
  let hydrated = false;
  const listeners = new Set<() => void>();

  function hydrate(): void {
    if (hydrated) return;
    hydrated = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);

      if (raw) {
        const parsed = JSON.parse(raw) as unknown;

        if (parsed && typeof parsed === "object") {
          state = parsed as T;
        }
      }
    } catch {
      /* ignore corrupt/blocked storage */
    }
  }

  function persist(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* ignore quota/blocked storage */
    }
  }

  function getState(): T {
    hydrate();

    return state;
  }

  function setState(updater: (prev: T) => T): void {
    hydrate();
    const next = updater(state);

    if (next === state) return;
    state = next;
    persist();
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function useStore<S>(selector: (state: T) => S): S {
    return useSyncExternalStore(
      subscribe,
      () => selector(getState()),
      () => selector(initialState)
    );
  }

  return { getState, setState, subscribe, useStore };
}
