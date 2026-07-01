"use client";

import type { FeatureHintId } from "./feature-hints";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

export type FeatureHintRegistration = {
  id: FeatureHintId;
  showWhen: boolean;
  anchorRef: RefObject<HTMLElement | null>;
};

type Listener = () => void;

const registrations = new Map<FeatureHintId, FeatureHintRegistration>();
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getSnapshot() {
  return registrations;
}

export function registerFeatureHintAnchor(registration: FeatureHintRegistration) {
  const prev = registrations.get(registration.id);

  if (
    prev &&
    prev.showWhen === registration.showWhen &&
    prev.anchorRef === registration.anchorRef
  ) {
    return;
  }

  registrations.set(registration.id, registration);
  emitChange();
}

export function unregisterFeatureHintAnchor(id: FeatureHintId) {
  registrations.delete(id);
  emitChange();
}

const FeatureHintRegistryContext = createContext<{
  register: (registration: FeatureHintRegistration) => void;
  unregister: (id: FeatureHintId) => void;
} | null>(null);

export function FeatureHintRegistryProvider({ children }: { children: ReactNode }) {
  const register = useCallback((registration: FeatureHintRegistration) => {
    registerFeatureHintAnchor(registration);
  }, []);

  const unregister = useCallback((id: FeatureHintId) => {
    unregisterFeatureHintAnchor(id);
  }, []);

  const value = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <FeatureHintRegistryContext.Provider value={value}>
      {children}
    </FeatureHintRegistryContext.Provider>
  );
}

export function useFeatureHintRegistry() {
  const context = useContext(FeatureHintRegistryContext);

  if (!context) {
    throw new Error("useFeatureHintRegistry must be used within FeatureHintRegistryProvider");
  }

  return context;
}

export function useFeatureHintRegistrations() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
