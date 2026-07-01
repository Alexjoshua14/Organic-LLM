import type { FeatureHintId } from "./feature-hints";
import {
  FEATURE_HINT_GUIDE_POLICY,
  clearFeatureHintGuideBreath,
  createInitialFeatureHintSessionState,
  featureHintSurfaceKey,
  type FeatureHintSessionState,
  recordAutoFeatureHintDismissed,
  syncFeatureHintSessionSurface,
} from "./feature-hint-guide-policy";
import { readFeatureHintDismissRecord } from "./feature-hint-storage";

type Listener = () => void;

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

let sessionState: FeatureHintSessionState | null = null;

function parseSessionState(raw: string | null): FeatureHintSessionState | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const record = parsed as Partial<FeatureHintSessionState>;

    if (
      typeof record.consecutiveAutoDismissCount !== "number" ||
      typeof record.breathPaused !== "boolean" ||
      typeof record.surfaceKey !== "string" ||
      typeof record.isBeginningSession !== "boolean"
    ) {
      return null;
    }

    return record as FeatureHintSessionState;
  } catch {
    return null;
  }
}

function readSessionFromStorage(
  storage: Pick<Storage, "getItem"> | null | undefined,
  pathname: string
): FeatureHintSessionState {
  const surfaceKey = featureHintSurfaceKey(pathname);
  const persisted = readFeatureHintDismissRecord(storage);
  const hasPersistedDismissals = Object.keys(persisted).length > 0;
  const stored = parseSessionState(storage?.getItem(FEATURE_HINT_GUIDE_POLICY.storageKey) ?? null);

  const base =
    stored ??
    createInitialFeatureHintSessionState(surfaceKey, hasPersistedDismissals);

  return syncFeatureHintSessionSurface(base, surfaceKey);
}

function writeSessionToStorage(
  storage: Pick<Storage, "setItem"> | null | undefined,
  state: FeatureHintSessionState
): void {
  if (!storage) return;

  storage.setItem(FEATURE_HINT_GUIDE_POLICY.storageKey, JSON.stringify(state));
}

export function getFeatureHintSessionState(pathname: string): FeatureHintSessionState {
  if (typeof window === "undefined") {
    return createInitialFeatureHintSessionState(featureHintSurfaceKey(pathname), false);
  }

  if (!sessionState) {
    sessionState = readSessionFromStorage(window.sessionStorage, pathname);
  }

  return sessionState;
}

export function subscribeFeatureHintSession(listener: Listener): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function syncFeatureHintSessionPath(pathname: string): FeatureHintSessionState {
  const next = syncFeatureHintSessionSurface(getFeatureHintSessionState(pathname), featureHintSurfaceKey(pathname));

  sessionState = next;
  writeSessionToStorage(typeof window !== "undefined" ? window.sessionStorage : null, next);
  emitChange();

  return next;
}

export function recordFeatureHintSessionDismiss(pathname: string): FeatureHintSessionState {
  const current = syncFeatureHintSessionPath(pathname);
  const next = recordAutoFeatureHintDismissed(current);

  sessionState = next;
  writeSessionToStorage(typeof window !== "undefined" ? window.sessionStorage : null, next);
  emitChange();

  return next;
}

export function clearFeatureHintSessionBreath(pathname: string): FeatureHintSessionState {
  const next = clearFeatureHintGuideBreath(syncFeatureHintSessionPath(pathname));

  sessionState = next;
  writeSessionToStorage(typeof window !== "undefined" ? window.sessionStorage : null, next);
  emitChange();

  return next;
}

/** Hints explicitly dismissed this browser tab (applies even in replay mode). */
const sessionDismissedHintIds = new Set<FeatureHintId>();
let sessionDismissVersion = 0;
let sessionDismissalsHydrated = false;

function parseSessionDismissedIds(raw: string | null): FeatureHintId[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id): id is FeatureHintId => typeof id === "string");
  } catch {
    return [];
  }
}

function hydrateSessionDismissalsFromStorage(): void {
  if (sessionDismissalsHydrated || typeof window === "undefined") return;

  sessionDismissalsHydrated = true;

  for (const id of parseSessionDismissedIds(
    window.sessionStorage.getItem(FEATURE_HINT_GUIDE_POLICY.sessionDismissedStorageKey)
  )) {
    sessionDismissedHintIds.add(id);
  }
}

function writeSessionDismissalsToStorage(): void {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    FEATURE_HINT_GUIDE_POLICY.sessionDismissedStorageKey,
    JSON.stringify([...sessionDismissedHintIds])
  );
}

export function getSessionDismissedFeatureHintIds(): ReadonlySet<FeatureHintId> {
  hydrateSessionDismissalsFromStorage();

  return sessionDismissedHintIds;
}

export function getSessionDismissedFeatureHintVersion(): number {
  return sessionDismissVersion;
}

export function recordSessionFeatureHintDismiss(id: FeatureHintId): void {
  hydrateSessionDismissalsFromStorage();

  if (sessionDismissedHintIds.has(id)) return;

  sessionDismissedHintIds.add(id);
  sessionDismissVersion += 1;
  writeSessionDismissalsToStorage();
  emitChange();
}

export function clearSessionFeatureHintDismissals(): void {
  hydrateSessionDismissalsFromStorage();

  if (sessionDismissedHintIds.size === 0) return;

  sessionDismissedHintIds.clear();
  sessionDismissVersion += 1;

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(FEATURE_HINT_GUIDE_POLICY.sessionDismissedStorageKey);
  }

  emitChange();
}

export function resetFeatureHintSessionForTests(): void {
  sessionState = null;
  sessionDismissedHintIds.clear();
  sessionDismissVersion = 0;
  sessionDismissalsHydrated = false;

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(FEATURE_HINT_GUIDE_POLICY.storageKey);
    window.sessionStorage.removeItem(FEATURE_HINT_GUIDE_POLICY.sessionDismissedStorageKey);
  }

  emitChange();
}
