"use client";

import type { TTSModel } from "@/lib/tts/token-calculator";

export type TtsClip = {
  id: string;
  createdAt: number;
  model: TTSModel;
  title: string;
  originalText: string;
  enhancedText: string | null;
  audioBlob: Blob;
  mimeType: string;
  format: string;
};

const DB_NAME = "organic-llm-tts";
const DB_VERSION = 1;
const STORE_NAME = "clips";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
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
        tx.onerror = () => {
          // keep request error as primary, but close db
          try {
            db.close();
          } catch {
            // ignore
          }
        };
      }),
  );
}

export async function saveTtsClip(clip: TtsClip): Promise<void> {
  await withStore("readwrite", (store) => store.put(clip)).then(() => undefined);
}

export async function getTtsClip(id: string): Promise<TtsClip | null> {
  const result = await withStore("readonly", (store) => store.get(id));
  return (result as unknown as TtsClip | undefined) ?? null;
}

export async function deleteTtsClip(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id)).then(() => undefined);
}

export async function listTtsClips(): Promise<TtsClip[]> {
  const result = await withStore("readonly", (store) => store.getAll());
  const clips = (result as unknown as TtsClip[]) ?? [];
  clips.sort((a, b) => b.createdAt - a.createdAt);
  return clips;
}

export function makeClipTitle(text: string, maxLen = 60): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t || "Untitled";
  return `${t.slice(0, maxLen - 1)}…`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

