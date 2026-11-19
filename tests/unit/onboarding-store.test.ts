import { afterEach, describe, expect, test } from "bun:test";

import { onboardingActions } from "@/lib/onboarding/onboarding-actions";
import {
  LEGACY_TIP_DISMISS_KEY,
  createOnboardingState,
  parseOnboardingState,
} from "@/lib/onboarding/onboarding-state";
import {
  ONBOARDING_IDLE_SNAPSHOT,
  ONBOARDING_SESSION_PREFIX,
  ONBOARDING_STORAGE_PREFIX,
  connectOnboardingStore,
  getOnboardingServerSnapshot,
  getOnboardingSnapshot,
  resetOnboardingStoreForTests,
  subscribeOnboarding,
} from "@/lib/onboarding/onboarding-store";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  failWrites = false;

  get length() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }

  getItem(key: string) {
    return this.map.get(key) ?? null;
  }

  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.map.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("quota", "QuotaExceededError");
    this.map.set(key, value);
  }
}

class EventHub {
  private listeners = new Set<EventListener>();

  addEventListener(_type: string, listener: EventListener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: EventListener) {
    this.listeners.delete(listener);
  }

  emit(event: { key: string; newValue: string | null }) {
    for (const listener of this.listeners) listener(event as unknown as Event);
  }

  get size() {
    return this.listeners.size;
  }
}

const USER = "user_test";
const KEY = `${ONBOARDING_STORAGE_PREFIX}${USER}`;

function setup(options: { local?: MemoryStorage; failWrites?: boolean } = {}) {
  const local = options.local ?? new MemoryStorage();
  const session = new MemoryStorage();
  const hub = new EventHub();

  local.failWrites = options.failWrites ?? false;

  const disconnect = connectOnboardingStore(USER, { local, session, target: hub });

  return { local, session, hub, disconnect };
}

afterEach(() => resetOnboardingStoreForTests());

describe("onboarding store", () => {
  test("is idle on the server and before connecting", () => {
    expect(getOnboardingServerSnapshot()).toBe(ONBOARDING_IDLE_SNAPSHOT);
    expect(getOnboardingSnapshot().status).toBe("idle");
    // Actions before connecting are safe no-ops.
    onboardingActions.dismissWelcome();
    expect(getOnboardingSnapshot()).toBe(ONBOARDING_IDLE_SNAPSHOT);
  });

  test("connects, migrates legacy dismissals once, and persists per account", () => {
    const local = new MemoryStorage();

    local.setItem(LEGACY_TIP_DISMISS_KEY, JSON.stringify({ "composer-search-memory": 2 }));
    setup({ local });

    const snapshot = getOnboardingSnapshot();

    expect(snapshot.status).toBe("ready");
    expect(snapshot.persistent).toBe(true);
    expect(snapshot.state.tips["composer-search-memory"]?.version).toBe(2);
    expect(parseOnboardingState(local.getItem(KEY))?.migratedLegacy).toBe(true);
    // Legacy keys stay for one release so a revert is safe.
    expect(local.getItem(LEGACY_TIP_DISMISS_KEY)).not.toBeNull();
  });

  test("snapshots are stable until something changes", () => {
    setup();

    const first = getOnboardingSnapshot();

    onboardingActions.setTipsEnabled(true);
    expect(getOnboardingSnapshot()).toBe(first);

    onboardingActions.setTipsEnabled(false);
    expect(getOnboardingSnapshot()).not.toBe(first);
    expect(getOnboardingSnapshot().state.tipsEnabled).toBe(false);
  });

  test("writes read the latest stored state, so another tab's progress survives", () => {
    const { local } = setup();

    // Another tab completes a step behind this tab's back.
    const other = { ...createOnboardingState(), migratedLegacy: true };

    other.checklist = { done: { "rabbit-hole": 1 } };
    local.setItem(KEY, JSON.stringify(other));

    onboardingActions.completeStep("first-message");

    const stored = parseOnboardingState(local.getItem(KEY));

    expect(stored?.checklist.done["rabbit-hole"]).toBe(1);
    expect(stored?.checklist.done["first-message"]).toBeNumber();
  });

  test("publishes changes from other tabs", () => {
    const { hub, local } = setup();
    let notified = 0;
    const unsubscribe = subscribeOnboarding(() => {
      notified += 1;
    });
    const next = { ...createOnboardingState(), migratedLegacy: true, tipsEnabled: false };

    local.setItem(KEY, JSON.stringify(next));
    hub.emit({ key: KEY, newValue: JSON.stringify(next) });
    hub.emit({ key: "unrelated", newValue: "{}" });
    unsubscribe();

    expect(notified).toBe(1);
    expect(getOnboardingSnapshot().state.tipsEnabled).toBe(false);
  });

  test("queued storage events cannot overwrite newer local state", async () => {
    const { hub, local } = setup();

    await onboardingActions.setTipsEnabled(false);
    const stale = local.getItem(KEY);
    await onboardingActions.setTipsEnabled(true);
    const latest = getOnboardingSnapshot();

    hub.emit({ key: KEY, newValue: stale });

    expect(getOnboardingSnapshot()).toBe(latest);
    expect(latest.state.tipsEnabled).toBe(true);
  });

  test("serializes tip claims and rejects delayed writes from a previous account", async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const pending: Array<() => void> = [];
    const locks = {
      request: (_key: string, callback: () => unknown) =>
        new Promise((resolve) => pending.push(() => resolve(callback()))),
    } as Pick<LockManager, "request">;

    connectOnboardingStore(USER, { local, session, locks });
    pending.shift()?.(); // Migration.

    const first = onboardingActions.claimTip(USER, (state) => state.tipLog.length === 0);
    const second = onboardingActions.claimTip(USER, (state) => state.tipLog.length === 0);

    expect(getOnboardingSnapshot().state.tipLog).toHaveLength(0);
    pending.shift()?.();
    pending.shift()?.();
    expect(await first).toBe(true);
    expect(await second).toBe(false);

    const completion = onboardingActions.completeStep("rabbit-hole", USER);

    connectOnboardingStore("another-user", { local, session });
    pending.shift()?.();
    expect(await completion).toBe(false);
    expect(getOnboardingSnapshot().state.checklist.done["rabbit-hole"]).toBeUndefined();
  });

  test("falls back to memory when storage writes fail", () => {
    setup({ failWrites: true });

    expect(getOnboardingSnapshot().persistent).toBe(false);

    onboardingActions.tipSeen("composer-search-memory", 2, "dismissed");

    expect(getOnboardingSnapshot().state.tips["composer-search-memory"]).toBeDefined();
  });

  test("corrupt stored data is replaced and flagged", () => {
    const local = new MemoryStorage();

    local.setItem(KEY, "{broken");
    setup({ local });

    expect(getOnboardingSnapshot().recovered).toBe(true);
    expect(getOnboardingSnapshot().state.tipsEnabled).toBe(true);
  });

  test("implicit closes hide a tip for the session and persist the count", () => {
    const { session } = setup();

    onboardingActions.tipClosedImplicitly("composer-search-memory", 2);

    const snapshot = getOnboardingSnapshot();

    expect(snapshot.sessionHiddenTips.has("composer-search-memory")).toBe(true);
    expect(snapshot.state.implicitCloses["composer-search-memory"]).toBe(1);
    expect(session.getItem(`${ONBOARDING_SESSION_PREFIX}${USER}`)).toContain(
      "composer-search-memory"
    );

    onboardingActions.replay();
    expect(getOnboardingSnapshot().sessionHiddenTips.size).toBe(0);
  });

  test("disconnect returns to idle and detaches the storage listener", () => {
    const { hub, disconnect } = setup();

    expect(hub.size).toBe(1);
    disconnect();
    expect(hub.size).toBe(0);
    expect(getOnboardingSnapshot()).toBe(ONBOARDING_IDLE_SNAPSHOT);
  });

  test("a different account gets its own namespace", () => {
    const { local } = setup();

    onboardingActions.dismissWelcome();
    connectOnboardingStore("user_other", { local, session: new MemoryStorage(), target: null });

    expect(getOnboardingSnapshot().userId).toBe("user_other");
    expect(getOnboardingSnapshot().state.welcomeDismissedAt).toBeUndefined();
  });
});
