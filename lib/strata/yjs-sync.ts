"use client";

import * as Y from "yjs";

import {
  StrataYjsAppendUpdateResponseSchema,
  StrataYjsSnapshotResponseSchema,
  type StrataYjsAppendUpdateResponse,
  type StrataYjsSnapshotResponse,
} from "@/lib/schemas/strata";

const YJS_API_PATH = "/api/prototypes/strata/notes/yjs";

/**
 * Encode the Yjs update bytes since the last server-acknowledged state vector. When `lastServerSV`
 * is null/undefined the full doc bytes are emitted (used for the first push or for seeding from a
 * legacy markdown body).
 */
export function encodeUpdateSinceSV(doc: Y.Doc, lastServerSV: Uint8Array | null): Uint8Array {
  return Y.encodeStateAsUpdateV2(doc, lastServerSV ?? undefined);
}

/** Decode an update produced by {@link encodeUpdateSinceSV} into a Yjs document in place. */
export function applyUpdateV2(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdateV2(doc, update);
}

/**
 * Browser-safe base64 helpers. Yjs updates are typically <1 KB so a synchronous loop is cheaper
 * than the Blob/FileReader trip and avoids leaking async into the keystroke path.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }

  return typeof window === "undefined"
    ? Buffer.from(bytes).toString("base64")
    : window.btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  if (!value) return new Uint8Array(0);
  if (typeof window === "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export type StrataYjsSnapshotBytes = {
  noteId: string;
  version: number;
  /** May be empty when the note has never been compacted server-side. */
  snapshot: Uint8Array;
  stateVector: Uint8Array;
  updates: { update: Uint8Array; createdAt: string }[];
};

function snapshotResponseToBytes(value: StrataYjsSnapshotResponse): StrataYjsSnapshotBytes {
  return {
    noteId: value.noteId,
    version: value.version,
    snapshot: base64ToBytes(value.snapshot),
    stateVector: base64ToBytes(value.stateVector),
    updates: value.updates.map((u) => ({
      update: base64ToBytes(u.update),
      createdAt: u.createdAt,
    })),
  };
}

export async function fetchSnapshotAndTail(params: {
  pageId: string;
  noteId: string;
  signal?: AbortSignal;
}): Promise<StrataYjsSnapshotBytes | null> {
  const url = `${YJS_API_PATH}?pageId=${encodeURIComponent(params.pageId)}&noteId=${encodeURIComponent(params.noteId)}`;
  const res = await fetch(url, { method: "GET", credentials: "include", signal: params.signal });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load Strata notepad snapshot (${res.status})`);
  }
  const data = (await res.json()) as unknown;
  const parsed = StrataYjsSnapshotResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid Strata notepad snapshot payload");
  }

  return snapshotResponseToBytes(parsed.data);
}

export async function postUpdate(params: {
  pageId: string;
  noteId: string;
  update: Uint8Array;
  clientId: string;
  signal?: AbortSignal;
}): Promise<StrataYjsAppendUpdateResponse> {
  const res = await fetch(YJS_API_PATH, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pageId: params.pageId,
      noteId: params.noteId,
      update: bytesToBase64(params.update),
      clientId: params.clientId,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    let detail = "";

    try {
      const errBody = (await res.json()) as { error?: unknown };

      if (typeof errBody?.error === "string") detail = `: ${errBody.error}`;
    } catch {}
    throw new Error(`Strata notepad update failed (${res.status})${detail}`);
  }
  const json = (await res.json()) as unknown;
  const parsed = StrataYjsAppendUpdateResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error("Invalid Strata notepad update response");
  }

  return parsed.data;
}

/**
 * Fire-and-forget unmount flush via `navigator.sendBeacon`. We cannot await a response (the page
 * is going away), so the client speculatively advances `lastServerSV` only after a normal POST.
 *
 * Returns `true` when the beacon was queued by the browser.
 */
export function postUpdateBeacon(params: {
  pageId: string;
  noteId: string;
  update: Uint8Array;
  clientId: string;
}): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }

  const payload = JSON.stringify({
    pageId: params.pageId,
    noteId: params.noteId,
    update: bytesToBase64(params.update),
    clientId: params.clientId,
  });
  const blob = new Blob([payload], { type: "application/json" });

  return navigator.sendBeacon(YJS_API_PATH, blob);
}
