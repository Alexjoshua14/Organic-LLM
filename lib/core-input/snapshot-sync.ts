import {
  coreInputSnapshots,
  SNAPSHOT_PUSH_BATCH_MAX,
  type CoreInputSnapshotStore,
  type SnapshotRow,
} from "./snapshot-store";

/** Quiet period after the last settings change before pushing to Supabase. */
export const SNAPSHOT_SYNC_DEBOUNCE_MS = 5_000;

const ENDPOINT = "/api/core-input/snapshots";

type SyncDeps = {
  store: CoreInputSnapshotStore;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

/**
 * Background Supabase sync for {@link CoreInputSnapshotStore}. Pulls once per page load,
 * pushes pending writes after a quiet period and on page hide. Signed-out users, a missing
 * table (503), or any network failure leave the device on its local cache; nothing here
 * ever blocks a render or a send.
 */
export function createSnapshotSync(deps: SyncDeps) {
  let started = false;
  let disabled = false;
  let pushHandle: unknown = null;
  let pushing = false;

  const disableOn = (status: number) => {
    if (status === 401 || status === 404 || status === 503) disabled = true;
  };

  const pull = async () => {
    try {
      const res = await deps.fetch(ENDPOINT, { cache: "no-store" });

      if (!res.ok) return disableOn(res.status);
      const body = (await res.json()) as { rows?: SnapshotRow[] };

      deps.store.mergeRemote(body.rows ?? []);
    } catch {
      // Offline: stay local.
    }
  };

  const push = async (keepalive = false) => {
    if (disabled || pushing) return;
    const rows = deps.store.pendingRows().slice(-SNAPSHOT_PUSH_BATCH_MAX);

    if (rows.length === 0) return;
    pushing = true;

    try {
      const res = await deps.fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        keepalive,
      });

      if (!res.ok) return disableOn(res.status);
      deps.store.acknowledge(rows);
    } catch {
      // Pending rows stay persisted locally and go out with the next push.
    } finally {
      pushing = false;
    }
  };

  return {
    /** Idempotent. Call when a scoped CoreInput mounts. */
    start() {
      if (started || typeof window === "undefined") return;
      started = true;
      void pull().then(() => push());

      window.addEventListener("pagehide", () => {
        deps.store.flush();
        void push(true);
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "hidden") return;
        deps.store.flush();
        void push(true);
      });
    },
    /** Call after a user change; pushes once changes go quiet. */
    schedulePush() {
      if (disabled) return;
      if (pushHandle !== null) deps.clearTimeout(pushHandle);
      pushHandle = deps.setTimeout(() => {
        pushHandle = null;
        void push();
      }, SNAPSHOT_SYNC_DEBOUNCE_MS);
    },
    pull,
    push,
  };
}

export const coreInputSnapshotSync = createSnapshotSync({
  store: coreInputSnapshots,
  fetch: (input, init) => fetch(input, init),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});
