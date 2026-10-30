import type { CoreInputScope } from "./scopes";
import type { CoreInputSettings } from "./settings";

import { writeSettingsCookie } from "./settings-cookie";
import {
  decodeSnapshot,
  encodeSnapshot,
  hashScopeKey,
  packSnapshotEntries,
  unpackSnapshotEntries,
  type DecodedSnapshot,
} from "./snapshot-codec";

/**
 * Most snapshots kept per device. 4,096 entries × 16 bytes is 64 KiB of binary, about
 * 87 KB once base64'd into localStorage. The server keeps the same cap per user.
 */
export const SNAPSHOT_CACHE_CAPACITY = 4096;

/** Rows per sync push; the route rejects larger batches. */
export const SNAPSHOT_PUSH_BATCH_MAX = 256;

/** Coalesces bursts of user changes into one localStorage write. */
export const SNAPSHOT_PERSIST_DEBOUNCE_MS = 400;

const CACHE_STORAGE_KEY = "organic-llm-core-input-snapshots";
const PENDING_STORAGE_KEY = "organic-llm-core-input-snapshots-pending";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type SnapshotRow = { scopeKey: string; value: number; updatedAt: number };

type StoreDeps = {
  storage: () => StorageLike | null;
  capacity?: number;
  onMirror?: (entries: Array<[number, number]>) => void;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
};

/**
 * Per-scope CoreInput settings, held as an insertion-ordered `Map` from scope-key hash to
 * packed value. Map order is the LRU order: a read or write moves the entry to the end and
 * eviction drops the first, so recency costs no extra bits per entry.
 *
 * Lookups are a single `Map.get`. There is no Bloom filter in front: one only pays off when
 * a negative answer saves a slow read, and both the cache and its misses are in memory once
 * loaded (the one-time server pull makes misses authoritative).
 *
 * Unsynced writes are tracked by full scope key in `pending`, persisted separately, so a
 * reload before the next sync loses nothing and the server never sees a bare hash.
 */
export class CoreInputSnapshotStore {
  private entries = new Map<number, number>();
  private pending = new Map<string, { value: number; updatedAt: number }>();
  private ephemeral = new Map<string, CoreInputSettings>();
  private listeners = new Set<() => void>();
  private loaded = false;
  private persistHandle: unknown = null;
  private readonly capacity: number;

  constructor(private readonly deps: StoreDeps) {
    this.capacity = deps.capacity ?? SNAPSHOT_CACHE_CAPACITY;
  }

  get size(): number {
    this.ensureLoaded();

    return this.entries.size;
  }

  /** Stored snapshot for one scope key. Refreshes memory and cookie recency, not sync writes. */
  read(scopeKey: string): DecodedSnapshot | null {
    this.ensureLoaded();
    const keyHash = hashScopeKey(scopeKey);
    const value = this.entries.get(keyHash);

    if (value === undefined) return null;
    this.entries.delete(keyHash);
    this.entries.set(keyHash, value);

    this.deps.onMirror?.([...this.entries]);

    return decodeSnapshot(value);
  }

  /** Records a user change. Never call this for settings that were only viewed. */
  write(scopeKey: string, settings: CoreInputSettings): void {
    this.ensureLoaded();
    const value = encodeSnapshot(settings);

    this.setEntry(hashScopeKey(scopeKey), value);
    this.pending.delete(scopeKey);
    this.pending.set(scopeKey, { value, updatedAt: this.now() });
    while (this.pending.size > this.capacity) {
      this.pending.delete(this.pending.keys().next().value!);
    }
    this.schedulePersist();
    this.deps.onMirror?.([...this.entries]);
  }

  writeEphemeral(scopeKey: string, settings: CoreInputSettings): void {
    this.ephemeral.set(scopeKey, settings);
  }

  clearEphemeral(scopeKey: string): void {
    this.ephemeral.delete(scopeKey);
  }

  /** Settings for a scope: its own snapshot, then each inherited key, then `fallback`. */
  resolve(scope: CoreInputScope, fallback: CoreInputSettings): CoreInputSettings {
    if (scope.ephemeral) {
      const session = this.ephemeral.get(scope.key);

      if (session) return session;
    }

    const keys = scope.ephemeral
      ? (scope.inheritFrom ?? [])
      : [scope.key, ...(scope.inheritFrom ?? [])];

    for (const key of keys) {
      const stored = this.read(key);

      if (stored) return { ...stored, modelId: stored.modelId ?? fallback.modelId };
    }

    return fallback;
  }

  /** Records a user change in a scope, honoring `ephemeral` and `writeThrough`. */
  commit(scope: CoreInputScope, settings: CoreInputSettings): void {
    if (scope.ephemeral) {
      this.writeEphemeral(scope.key, settings);

      return;
    }

    this.write(scope.key, settings);
    for (const key of scope.writeThrough ?? []) this.write(key, settings);
  }

  pendingRows(): SnapshotRow[] {
    this.ensureLoaded();

    return [...this.pending].map(([scopeKey, row]) => ({ scopeKey, ...row }));
  }

  /** Clears a pending write once the server has it, unless a newer write landed since. */
  acknowledge(rows: readonly SnapshotRow[]): void {
    let changed = false;

    for (const row of rows) {
      const current = this.pending.get(row.scopeKey);

      if (current && current.updatedAt <= row.updatedAt) {
        this.pending.delete(row.scopeKey);
        changed = true;
      }
    }

    if (changed) this.schedulePersist();
  }

  /**
   * Folds server rows in, oldest first so the newest end up most recent. A local write
   * that has not synced yet wins over an older server row. Returns whether anything changed.
   */
  mergeRemote(rows: readonly SnapshotRow[]): boolean {
    this.ensureLoaded();
    let changed = false;

    for (const row of [...rows].sort((a, b) => a.updatedAt - b.updatedAt)) {
      const local = this.pending.get(row.scopeKey);

      if (local && local.updatedAt >= row.updatedAt) continue;
      if (!Number.isSafeInteger(row.value) || decodeSnapshot(row.value) === null) continue;

      const keyHash = hashScopeKey(row.scopeKey);

      if (this.entries.get(keyHash) !== row.value) changed = true;
      this.setEntry(keyHash, row.value);
    }

    if (changed) {
      this.deps.onMirror?.([...this.entries]);
      this.schedulePersist();
      this.listeners.forEach((listener) => listener());
    }

    return changed;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  /** Writes pending state to storage now (e.g. on page hide). */
  flush(): void {
    if (this.persistHandle !== null) {
      (this.deps.clearTimeout ?? clearTimeout)(this.persistHandle as never);
      this.persistHandle = null;
    }
    this.persist();
  }

  private setEntry(keyHash: number, value: number): void {
    this.entries.delete(keyHash);
    this.entries.set(keyHash, value);
    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    const storage = this.deps.storage();

    if (!storage) return;
    this.loaded = true;

    try {
      const packed = storage.getItem(CACHE_STORAGE_KEY);

      for (const [keyHash, value] of packed ? unpackSnapshotEntries(packed) : []) {
        this.setEntry(keyHash, value);
      }

      const pending = JSON.parse(storage.getItem(PENDING_STORAGE_KEY) ?? "{}") as Record<
        string,
        [number, number]
      >;

      for (const [scopeKey, [value, updatedAt]] of Object.entries(pending)) {
        if (Number.isSafeInteger(value) && Number.isFinite(updatedAt)) {
          this.pending.set(scopeKey, { value, updatedAt });
        }
      }
    } catch {
      // Corrupt storage starts empty; the server pull refills it.
    }
  }

  private schedulePersist(): void {
    if (this.persistHandle !== null) return;
    this.persistHandle = (this.deps.setTimeout ?? setTimeout)(() => {
      this.persistHandle = null;
      this.persist();
    }, SNAPSHOT_PERSIST_DEBOUNCE_MS);
  }

  private persist(): void {
    const storage = this.deps.storage();

    if (!storage || !this.loaded) return;

    try {
      storage.setItem(CACHE_STORAGE_KEY, packSnapshotEntries([...this.entries]));
      storage.setItem(
        PENDING_STORAGE_KEY,
        JSON.stringify(
          Object.fromEntries(
            [...this.pending].map(([scopeKey, row]) => [scopeKey, [row.value, row.updatedAt]])
          )
        )
      );
    } catch {
      // Quota or private-mode failures keep the in-memory cache; nothing user-visible breaks.
    }
  }
}

export const coreInputSnapshots = new CoreInputSnapshotStore({
  onMirror: (entries) => writeSettingsCookie({ entries }),
  storage: () => (typeof localStorage === "undefined" ? null : localStorage),
});
