import type { CoreInputSettings } from "@/lib/core-input/settings";

import { describe, expect, test } from "bun:test";

import { coreInputScopes } from "@/lib/core-input/scopes";
import { encodeSnapshot } from "@/lib/core-input/snapshot-codec";
import { CoreInputSnapshotStore } from "@/lib/core-input/snapshot-store";
import { ChatModels } from "@/lib/schemas/chat";

const fallback: CoreInputSettings = {
  modelId: ChatModels[0]!.id,
  effort: "auto",
  contextEffort: "quick",
  webSearch: true,
  memories: true,
  speechFriendly: false,
};
const other: CoreInputSettings = {
  ...fallback,
  modelId: ChatModels[1]!.id,
  effort: "low",
  webSearch: false,
};

function memoryStorage() {
  const data = new Map<string, string>();

  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function createStore(options: { capacity?: number; storage?: ReturnType<typeof memoryStorage> } = {}) {
  const storage = options.storage ?? memoryStorage();
  const timers: Array<() => void> = [];
  let now = 1_000;
  const store = new CoreInputSnapshotStore({
    storage: () => storage,
    capacity: options.capacity,
    now: () => now,
    setTimeout: (fn) => {
      timers.push(fn);

      return timers.length;
    },
    clearTimeout: () => {},
  });

  return {
    store,
    storage,
    runTimers: () => timers.splice(0).forEach((fn) => fn()),
    tick: (ms: number) => {
      now += ms;
    },
  };
}

describe("core input snapshot store", () => {
  test("a thread with no snapshot inherits its area, then the fallback", () => {
    const { store } = createStore();
    const thread = coreInputScopes.thread("arcadia", "t1");

    expect(store.resolve(thread, fallback)).toEqual(fallback);
    store.write("arcadia", other);
    expect(store.resolve(thread, fallback)).toEqual(other);
  });

  test("a thread change writes through to its area so new threads start from it", () => {
    const { store } = createStore();

    store.commit(coreInputScopes.thread("arcadia", "t1"), other);
    expect(store.resolve(coreInputScopes.thread("arcadia", "t2"), fallback)).toEqual(other);
    // Another area is untouched.
    expect(store.resolve(coreInputScopes.thread("aion", "t3"), fallback)).toEqual(fallback);
  });

  test("a /btw scope seeds from its thread, keeps changes in memory only, and forgets on close", () => {
    const { store, storage, runTimers } = createStore();
    const thread = coreInputScopes.thread("arcadia", "t1");
    const btw = coreInputScopes.btw("arcadia", "t1");

    store.commit(thread, other);
    runTimers();
    const persisted = storage.data.get("organic-llm-core-input-snapshots");

    expect(store.resolve(btw, fallback)).toEqual(other);
    store.commit(btw, { ...other, memories: false });
    expect(store.resolve(btw, fallback).memories).toBe(false);
    // The thread snaps back to what it had; nothing reached storage or the sync queue.
    expect(store.resolve(thread, fallback)).toEqual(other);
    runTimers();
    expect(storage.data.get("organic-llm-core-input-snapshots")).toBe(persisted);
    expect(store.pendingRows().map((row) => row.scopeKey)).not.toContain(btw.key);

    store.clearEphemeral(btw.key);
    expect(store.resolve(btw, fallback)).toEqual(other);
  });

  test("evicts the least recently used entry at capacity; reads count as use", () => {
    const { store } = createStore({ capacity: 3 });

    store.write("a", other);
    store.write("b", other);
    store.write("c", other);
    expect(store.read("a")).not.toBeNull();
    store.write("d", other);

    expect(store.size).toBe(3);
    expect(store.read("b")).toBeNull();
    expect(store.read("a")).not.toBeNull();
  });

  test("persists packed entries and pending writes, and reloads them", () => {
    const { store, storage, runTimers } = createStore();

    store.write("arcadia:thread:t1", other);
    runTimers();

    const reloaded = createStore({ storage }).store;

    expect(reloaded.resolve(coreInputScopes.thread("arcadia", "t1"), fallback)).toEqual(other);
    expect(reloaded.pendingRows()).toEqual([
      { scopeKey: "arcadia:thread:t1", value: encodeSnapshot(other), updatedAt: 1_000 },
    ]);
  });

  test("an unsynced local write beats an older server row; a newer row wins", () => {
    const { store, tick } = createStore();

    store.write("aion", other);
    tick(10);
    expect(
      store.mergeRemote([{ scopeKey: "aion", value: encodeSnapshot(fallback), updatedAt: 500 }])
    ).toBe(false);
    expect(store.resolve(coreInputScopes.area("aion"), fallback)).toEqual(other);

    expect(
      store.mergeRemote([{ scopeKey: "aion", value: encodeSnapshot(fallback), updatedAt: 5_000 }])
    ).toBe(true);
    expect(store.resolve(coreInputScopes.area("aion"), fallback)).toEqual(fallback);
  });

  test("merge notifies subscribers and skips undecodable rows", () => {
    const { store } = createStore();
    let calls = 0;

    store.subscribe(() => {
      calls += 1;
    });
    store.mergeRemote([{ scopeKey: "x", value: 0, updatedAt: 1 }]);
    expect(calls).toBe(0);
    store.mergeRemote([{ scopeKey: "x", value: encodeSnapshot(other), updatedAt: 1 }]);
    expect(calls).toBe(1);
  });

  test("acknowledge clears synced rows but keeps a write made after the push", () => {
    const { store, tick } = createStore();

    store.write("a", other);
    store.write("b", other);
    const pushed = store.pendingRows();

    tick(10);
    store.write("b", fallback);
    store.acknowledge(pushed);

    expect(store.pendingRows().map((row) => row.scopeKey)).toEqual(["b"]);
  });

  test("a stored snapshot whose model left the registry keeps the fallback model", () => {
    const { store } = createStore();

    store.write("aion", { ...other, modelId: "retired/model" });
    expect(store.resolve(coreInputScopes.area("aion"), fallback)).toEqual({
      ...other,
      modelId: fallback.modelId,
    });
  });
});
