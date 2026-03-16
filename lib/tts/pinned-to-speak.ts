"use client";

export type PinnedForSpeak = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
};

const DB_NAME = "organic-llm-pinned-speak";
const DB_VERSION = 1;
const STORE_NAME = "items";
const MAX_TITLE_LEN = 60;

/** Generate a short title from message content (first line or first N chars). */
export function makePinnedTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");

  if (!trimmed) return "Untitled";
  const firstLine = trimmed.split(/\n/)[0]?.trim() ?? trimmed;

  if (firstLine.length <= MAX_TITLE_LEN) return firstLine;

  return `${firstLine.slice(0, MAX_TITLE_LEN - 1)}…`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));

      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });

        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
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

        request.onerror = () => reject(request.error ?? new Error("IDB request failed"));
        request.onsuccess = () => resolve(request.result);
        tx.oncomplete = () => db.close();
      })
  );
}

export async function addPinnedFromChat(content: string): Promise<PinnedForSpeak> {
  const id = `pinned-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const item: PinnedForSpeak = {
    id,
    title: makePinnedTitle(content),
    content: content.trim(),
    createdAt: Date.now(),
  };

  await withStore("readwrite", (store) => store.put(item));

  return item;
}

export async function listPinnedForSpeak(): Promise<PinnedForSpeak[]> {
  const result = await withStore("readonly", (store) => store.getAll());
  const items = (result as PinnedForSpeak[]) ?? [];

  items.sort((a, b) => b.createdAt - a.createdAt);

  return items;
}

export async function getPinnedForSpeak(id: string): Promise<PinnedForSpeak | null> {
  const result = await withStore("readonly", (store) => store.get(id));

  return (result as PinnedForSpeak | undefined) ?? null;
}

export async function removePinnedForSpeak(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}
