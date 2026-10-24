"use client";

const DB_NAME = "organic-llm-spatial-pins";
const DB_VERSION = 1;
const STORE_NAME = "pins";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));

      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);

        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        request.onsuccess = () => resolve(request.result);
        tx.oncomplete = () => db.close();
      })
  );
}

export async function pinArtifactLocal(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.put({ id, pinnedAt: Date.now() }));
}

export async function unpinArtifactLocal(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function listPinnedArtifactIds(): Promise<string[]> {
  const rows = await withStore("readonly", (store) => store.getAll());

  return (rows as { id: string }[]).map((row) => row.id);
}

export async function isArtifactPinnedLocal(id: string): Promise<boolean> {
  const row = await withStore("readonly", (store) => store.get(id));

  return row != null;
}
