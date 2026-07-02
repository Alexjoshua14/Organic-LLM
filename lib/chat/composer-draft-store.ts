"use client";

import {
  decryptComposerDraft,
  encryptComposerDraft,
  type ComposerDraftEncryptionContext,
} from "@/lib/crypto/composer-draft-encryption";

const DB_NAME = "organic-llm-composer-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const COMPOSER_DRAFT_MAX_BYTES = 32 * 1024;

export type ComposerDraftRecord = {
  chatId: string;
  userId: string | null;
  ciphertext: string;
  updatedAt: number;
};

let openDbPromise: Promise<IDBDatabase> | null = null;

export function isComposerDraftPersistenceEnabled(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (openDbPromise) return openDbPromise;

  openDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));

      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open composer drafts DB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "chatId" });
      }
    };
  });

  return openDbPromise;
}

function isExpired(updatedAt: number): boolean {
  return Date.now() - updatedAt > DRAFT_TTL_MS;
}

function buildContext(chatId: string, userId?: string | null): ComposerDraftEncryptionContext {
  return { chatId, userId };
}

async function idbGetRecord(chatId: string): Promise<ComposerDraftRecord | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(chatId);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as ComposerDraftRecord | undefined);
  });
}

async function idbPutRecord(record: ComposerDraftRecord): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

async function idbDeleteRecord(chatId: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(chatId);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

async function idbGetAllRecords(): Promise<ComposerDraftRecord[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as ComposerDraftRecord[]) ?? []);
  });
}

export async function pruneExpiredDrafts(): Promise<void> {
  if (!isComposerDraftPersistenceEnabled()) return;

  try {
    const records = await idbGetAllRecords();

    await Promise.all(
      records
        .filter((record) => isExpired(record.updatedAt))
        .map((record) => idbDeleteRecord(record.chatId))
    );
  } catch {
    /* best-effort */
  }
}

export async function loadDraft(
  chatId: string,
  userId?: string | null
): Promise<string | null> {
  if (!chatId || !isComposerDraftPersistenceEnabled()) return null;

  try {
    await pruneExpiredDrafts();

    const record = await idbGetRecord(chatId);

    if (!record || isExpired(record.updatedAt)) {
      if (record) await idbDeleteRecord(chatId);

      return null;
    }

    if (userId && record.userId && record.userId !== userId) {
      return null;
    }

    const plaintext = await decryptComposerDraft(
      record.ciphertext,
      buildContext(chatId, userId ?? record.userId)
    );

    return plaintext;
  } catch {
    return null;
  }
}

export async function saveDraft(
  chatId: string,
  text: string,
  userId?: string | null
): Promise<void> {
  if (!chatId || !isComposerDraftPersistenceEnabled()) return;

  const trimmed = text;

  if (!trimmed.trim()) {
    await clearDraft(chatId);

    return;
  }

  const byteLength = new TextEncoder().encode(trimmed).byteLength;

  if (byteLength > COMPOSER_DRAFT_MAX_BYTES) return;

  try {
    const ciphertext = await encryptComposerDraft(trimmed, buildContext(chatId, userId));
    const record: ComposerDraftRecord = {
      chatId,
      userId: userId ?? null,
      ciphertext,
      updatedAt: Date.now(),
    };

    await idbPutRecord(record);
  } catch {
    /* best-effort */
  }
}

export async function clearDraft(chatId: string): Promise<void> {
  if (!chatId) return;

  try {
    await idbDeleteRecord(chatId);
  } catch {
    /* best-effort */
  }
}

/** Removes all stored drafts (sign-out hooks, tests). */
export async function clearAllComposerDrafts(): Promise<void> {
  try {
    const records = await idbGetAllRecords();

    await Promise.all(records.map((record) => idbDeleteRecord(record.chatId)));
  } catch {
    /* best-effort */
  }
}

/** Test helper: reset module-level DB promise between tests. */
export function resetComposerDraftStoreForTests(): void {
  openDbPromise = null;
}
