/**
 * Client-side audio cache for TTS (ElevenLabs etc.).
 * Uses IndexedDB for secure, same-origin storage (no audio in URLs or localStorage).
 * Keys are SHA-256 hashes of the request payload so message content is not stored in plain text.
 * Designed so the same API can later persist to Supabase/blob by swapping the implementation.
 */

const DB_NAME = "organic-llm-tts-cache";
const DB_VERSION = 1;
const STORE_NAME = "audio";

export type TTSCacheKeyInput = {
  text: string;
  model?: string;
  skipTransform?: boolean;
};

/** Compute a deterministic cache key (SHA-256 hex) so the same input never hits the network twice. */
export async function getTTSCacheKey(input: TTSCacheKeyInput): Promise<string> {
  const payload = JSON.stringify({
    text: input.text,
    model: input.model ?? "eleven_multilingual_v2",
    skipTransform: input.skipTransform ?? false,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));

      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/** Get cached audio blob for a key, or null if miss. */
export async function getTTSFromCache(key: string): Promise<Blob | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);

    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      const value = req.result;

      resolve(value != null ? (value as Blob) : null);
    };
  });
}

/** Store an audio blob for a key. Overwrites if the key already exists. */
export async function setTTSInCache(key: string, blob: Blob): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, key);

    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}
