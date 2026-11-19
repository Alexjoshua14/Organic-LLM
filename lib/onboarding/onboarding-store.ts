import { AUTO_FEATURE_TIP_IDS } from "./feature-tips";
import {
  LEGACY_FIRST_SESSION_KEY,
  LEGACY_TIP_DISMISS_KEY,
  createOnboardingState,
  migrateLegacyOnboarding,
  parseOnboardingState,
  type OnboardingState,
} from "./onboarding-state";

/**
 * Browser persistence for onboarding state, one namespace per signed-in account on this device.
 *
 * - One localStorage key per account (`organic-llm-onboarding:<userId>`), versioned JSON.
 * - One sessionStorage key per account for tips hidden "for this visit" (implicit closes).
 * - Web Locks serialize per-account writes across tabs where available. Storage notifications
 *   trigger a fresh read so delayed events cannot roll back the current snapshot.
 * - When storage is unavailable or throws, state lives in memory for the tab (`persistent: false`).
 *
 * Snapshots are immutable and only replaced on change, as `useSyncExternalStore` requires.
 * `connect` runs from an effect in `OnboardingHost`, never during render.
 */

export const ONBOARDING_STORAGE_PREFIX = "organic-llm-onboarding:";
export const ONBOARDING_SESSION_PREFIX = "organic-llm-onboarding-session:";

export type OnboardingSnapshot = {
  /** `idle` until a signed-in account is connected on the client. */
  status: "idle" | "ready";
  userId: string | null;
  /** False when storage could not be read or written; state then lives in memory for this tab. */
  persistent: boolean;
  /** True when stored data existed but could not be read, so a fresh state replaced it. */
  recovered: boolean;
  state: OnboardingState;
  sessionHiddenTips: ReadonlySet<string>;
};

export type OnboardingStorageEnv = {
  local: Storage | null;
  session: Storage | null;
  /** Window to listen on for cross-tab `storage` events. */
  target?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  locks?: Pick<LockManager, "request">;
};

const EMPTY_HIDDEN: ReadonlySet<string> = new Set();

/** Constant server (and pre-connect) snapshot. */
export const ONBOARDING_IDLE_SNAPSHOT: OnboardingSnapshot = Object.freeze({
  status: "idle",
  userId: null,
  persistent: false,
  recovered: false,
  state: createOnboardingState(),
  sessionHiddenTips: EMPTY_HIDDEN,
});

type Listener = () => void;

const listeners = new Set<Listener>();
let snapshot: OnboardingSnapshot = ONBOARDING_IDLE_SNAPSHOT;
let env: OnboardingStorageEnv | null = null;
let detachStorageListener: (() => void) | null = null;
/** Serialized form of `snapshot.state` as last read from or written to storage. */
let lastRaw: string | null = null;

function publish(next: OnboardingSnapshot) {
  if (next === snapshot) return;
  snapshot = next;

  for (const listener of listeners) listener();
}

function localKey(userId: string) {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`;
}

function sessionKey(userId: string) {
  return `${ONBOARDING_SESSION_PREFIX}${userId}`;
}

function safeGet(storage: Storage | null | undefined, key: string): string | null | undefined {
  if (!storage) return undefined;

  try {
    return storage.getItem(key);
  } catch {
    return undefined;
  }
}

function safeSet(storage: Storage | null | undefined, key: string, value: string): boolean {
  if (!storage) return false;

  try {
    storage.setItem(key, value);

    return true;
  } catch {
    return false;
  }
}

function readSessionHidden(userId: string): ReadonlySet<string> {
  const raw = safeGet(env?.session, sessionKey(userId));

  if (!raw) return EMPTY_HIDDEN;

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === "string"))
      : EMPTY_HIDDEN;
  } catch {
    return EMPTY_HIDDEN;
  }
}

function defaultEnv(): OnboardingStorageEnv {
  if (typeof window === "undefined") return { local: null, session: null, target: null };

  const pick = (get: () => Storage): Storage | null => {
    try {
      return get();
    } catch {
      return null;
    }
  };

  return {
    local: pick(() => window.localStorage),
    session: pick(() => window.sessionStorage),
    target: window,
    locks: window.navigator.locks,
  };
}

/**
 * Connects the store to an account. `null` (signed out, or auth still loading) returns to idle.
 * Returns a disconnect function for effect cleanup.
 */
export function connectOnboardingStore(
  userId: string | null,
  storageEnv: OnboardingStorageEnv = defaultEnv()
): () => void {
  detachStorageListener?.();
  detachStorageListener = null;
  env = storageEnv;

  lastRaw = null;

  if (!userId) {
    publish(ONBOARDING_IDLE_SNAPSHOT);

    return () => {};
  }

  const raw = safeGet(env.local, localKey(userId));
  const readable = raw !== undefined;
  const parsed = parseOnboardingState(raw ?? null);
  const recovered = raw != null && parsed == null;
  let state = parsed ?? createOnboardingState();
  let persistent = readable;

  lastRaw = raw ?? null;

  if (!state.migratedLegacy) {
    state = migrateLegacyOnboarding(
      state,
      {
        tipDismissals: safeGet(env.local, LEGACY_TIP_DISMISS_KEY) ?? null,
        firstSession: safeGet(env.local, LEGACY_FIRST_SESSION_KEY) ?? null,
      },
      AUTO_FEATURE_TIP_IDS,
      Date.now()
    );
    if (persistent && !env.locks) {
      const serialized = JSON.stringify(state);

      persistent = safeSet(env.local, localKey(userId), serialized);
      if (persistent) lastRaw = serialized;
    }
  }

  publish({
    status: "ready",
    userId,
    persistent,
    recovered,
    state,
    sessionHiddenTips: readSessionHidden(userId),
  });

  const target = env.target;

  if (target) {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== localKey(userId) || snapshot.userId !== userId || !snapshot.persistent) {
        return;
      }

      const latest = safeGet(storageEnv.local, localKey(userId));

      if (latest == null || latest === lastRaw) return;
      const next = parseOnboardingState(latest);

      if (!next) return;
      lastRaw = latest;
      publish({ ...snapshot, state: next });
    };

    target.addEventListener("storage", onStorage as EventListener);
    detachStorageListener = () => target.removeEventListener("storage", onStorage as EventListener);
  }

  if (persistent && storageEnv.locks && !parsed?.migratedLegacy) {
    // Persist migration under the same lock as regular writes. A different tab may have
    // initialized the account while we waited, in which case its stored state wins.
    void updateOnboardingState((base) => ({ ...base, migratedLegacy: true }), userId);
  }

  const connectedUser = userId;

  return () => {
    if (snapshot.userId !== connectedUser) return;
    detachStorageListener?.();
    detachStorageListener = null;
    publish(ONBOARDING_IDLE_SNAPSHOT);
  };
}

/**
 * Applies a reducer to the latest account state. Resolves true if the reducer changed it.
 * The fallback for browsers without Web Locks still reads the latest available value first.
 */
export async function updateOnboardingState(
  reducer: (state: OnboardingState) => OnboardingState,
  userId = snapshot.userId
): Promise<boolean> {
  if (!userId || snapshot.userId !== userId) return false;

  const connection = env;
  const apply = () => {
    if (env !== connection || snapshot.userId !== userId) return false;

    return applyOnboardingUpdate(reducer, userId);
  };

  if (snapshot.persistent && connection?.locks) {
    return connection.locks.request(localKey(userId), apply).catch(() => false);
  }

  return apply();
}

function applyOnboardingUpdate(
  reducer: (state: OnboardingState) => OnboardingState,
  userId: string
): boolean {
  const current = snapshot;
  let base = current.state;

  if (current.persistent) {
    const raw = safeGet(env?.local, localKey(userId));

    // Only a different stored value (another tab wrote) replaces the state in memory.
    if (raw != null && raw !== lastRaw) {
      const stored = parseOnboardingState(raw);

      if (stored) {
        base = stored;
        lastRaw = raw;
      }
    }
  }

  const next = reducer(base);

  if (next === base) {
    if (base !== current.state) publish({ ...current, state: base });

    return false;
  }

  let persistent = current.persistent;

  if (persistent) {
    const serialized = JSON.stringify(next);

    persistent = safeSet(env?.local, localKey(userId), serialized);
    if (persistent) lastRaw = serialized;
  }

  publish({ ...current, persistent, state: next });

  return true;
}

/** Hides a tip for the rest of this tab session (after an implicit close). */
export function hideTipForSession(id: string): void {
  const current = snapshot;

  if (current.status !== "ready" || !current.userId || current.sessionHiddenTips.has(id)) return;

  const next = new Set(current.sessionHiddenTips).add(id);

  safeSet(env?.session, sessionKey(current.userId), JSON.stringify([...next]));
  publish({ ...current, sessionHiddenTips: next });
}

export function clearSessionHiddenTips(): void {
  const current = snapshot;

  if (current.status !== "ready" || !current.userId || current.sessionHiddenTips.size === 0) return;

  safeSet(env?.session, sessionKey(current.userId), "[]");
  publish({ ...current, sessionHiddenTips: EMPTY_HIDDEN });
}

export function subscribeOnboarding(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getOnboardingSnapshot(): OnboardingSnapshot {
  return snapshot;
}

export function getOnboardingServerSnapshot(): OnboardingSnapshot {
  return ONBOARDING_IDLE_SNAPSHOT;
}

/** Test helper: back to idle with no storage attached. */
export function resetOnboardingStoreForTests(): void {
  detachStorageListener?.();
  detachStorageListener = null;
  env = null;
  lastRaw = null;
  snapshot = ONBOARDING_IDLE_SNAPSHOT;

  for (const listener of listeners) listener();
}
