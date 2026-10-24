"use client";

/**
 * Device-local non-extractable root key for composer draft encryption.
 *
 * Security bounds (browser-local):
 * - Key material is a non-extractable CryptoKey in IndexedDB; raw bytes are not persisted.
 * - Does not protect against XSS, same-origin malicious JS, or full profile access while the app runs.
 * - Separate namespace from Strata local encryption.
 */

const DB_NAME = "organic-llm-composer-crypto";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const DEVICE_ROOT_KEY_ID = "device-root-v1";
const AES_KEY_BYTES = 32;

let openDbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (openDbPromise) return openDbPromise;

  openDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));

      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open composer crypto DB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return openDbPromise;
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result as T | undefined);
      })
  );
}

function idbPut(key: string, value: CryptoKey): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);

        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      })
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);

        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      })
  );
}

async function createDeviceRootKey(): Promise<CryptoKey> {
  const seed = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES));

  return crypto.subtle.importKey("raw", seed, "HKDF", false, ["deriveKey"]);
}

/** Returns the device root HKDF key (non-extractable), creating and persisting it on first use. */
export async function getOrCreateDeviceRootKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(DEVICE_ROOT_KEY_ID);

  if (existing) return existing;

  const key = await createDeviceRootKey();

  await idbPut(DEVICE_ROOT_KEY_ID, key);

  return key;
}

/** Clears the device root key (tests, sign-out hooks). Existing ciphertext becomes undecryptable. */
export async function clearDeviceRootKey(): Promise<void> {
  await idbDelete(DEVICE_ROOT_KEY_ID);
  openDbPromise = null;
}

/** Test helper: reset module-level DB promise between tests. */
export function resetComposerDeviceKeyForTests(): void {
  openDbPromise = null;
}
