"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

import { clientRandomUUID } from "@/lib/client-uuid";
import {
  encodeUpdateSinceSV,
  fetchSnapshotAndTail,
  postUpdate,
  postUpdateBeacon,
} from "@/lib/strata/yjs-sync";

const FLUSH_DEBOUNCE_MS = 500;

const BLOCKNOTE_FRAGMENT_FIELD = "blocknote";

type FlushOptions = { beacon?: boolean };

export type StrataNotepadHook = {
  /** Stable Y.Doc instance for this `(pageId, noteId)` pair. Recreated when noteId changes. */
  doc: Y.Doc;
  /** True after IDB sync + initial server hydration finish (or fail gracefully). */
  ready: boolean;
  /** Manually flush any local-only edits to the server. Called on Save now / on demand. */
  flushToServer: (options?: FlushOptions) => Promise<void> | void;
  /** Manually replace `lastSentSV` (used after seeding the doc from a legacy markdown body). */
  markServerSeen: () => void;
  /** Stable per-tab/per-note client id sent on every POST. */
  clientId: string;
};

/**
 * Owns the lifetime of one BlockNote-backed note's Y.Doc:
 *
 *   keystroke -> Y.Doc (sync) -> IndexedDB (async, undebounced)
 *                              -> 500ms idle / Save now / unmount -> Supabase POST
 *
 * IDB persistence runs unsupervised — we trust `y-indexeddb` to coalesce writes via Yjs
 * transactions. The only debounce in the system sits at the network boundary (`flushTimerRef`),
 * matching the spec.
 */
export function useStrataNotepad(params: { pageId: string; noteId: string }): StrataNotepadHook {
  const { pageId, noteId } = params;

  const [doc, setDoc] = useState<Y.Doc>(() => new Y.Doc());
  const [ready, setReady] = useState(false);

  const clientId = useMemo(() => clientRandomUUID(), []);

  const lastSentSVRef = useRef<Uint8Array | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushInFlightRef = useRef<Promise<void> | null>(null);

  const flushToServer = useCallback(
    async (options?: FlushOptions): Promise<void> => {
      const beacon = options?.beacon ?? false;
      const updateBytes = encodeUpdateSinceSV(doc, lastSentSVRef.current);

      if (updateBytes.byteLength === 0) return;

      const svBeforePost = Y.encodeStateVector(doc);

      if (beacon) {
        const queued = postUpdateBeacon({ pageId, noteId, update: updateBytes, clientId });

        if (queued) {
          lastSentSVRef.current = svBeforePost;
        }

        return;
      }

      try {
        await postUpdate({ pageId, noteId, update: updateBytes, clientId });
        lastSentSVRef.current = svBeforePost;
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[strata-notepad] flushToServer failed", err);
        }
      }
    },
    [clientId, doc, noteId, pageId]
  );

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushInFlightRef.current = flushToServer().finally(() => {
        flushInFlightRef.current = null;
      });
    }, FLUSH_DEBOUNCE_MS);
  }, [flushToServer]);

  useEffect(() => {
    /**
     * Mount-scoped lifecycle. The parent renders `<StrataNotepad key={activeNoteId} />`, so any
     * note switch is a full unmount/remount and `pageId`/`noteId`/`clientId` are stable for the
     * lifetime of this hook instance.
     *
     * The doc must be created *inside* setup (not just in `useState` lazy init): React Strict
     * Mode runs setup -> cleanup -> setup with state preserved, so a doc held only in state would
     * be destroyed by the first cleanup and the second setup would attach IDB to a dead instance.
     * `setDoc(newDoc)` republishes the fresh doc to consumers (`useCreateBlockNote(..., [doc])`).
     *
     * The hydrate IIFE wraps the whole path in `try/finally` so `setReady(true)` still runs on
     * the surviving mount even if `cancelled` flips after `whenSynced` resolves.
     */
    const newDoc = new Y.Doc();

    setDoc(newDoc);
    setReady(false);
    lastSentSVRef.current = null;

    const idb = new IndexeddbPersistence(`strata-note:${pageId}:${noteId}`, newDoc);

    let cancelled = false;
    const abort = new AbortController();

    (async () => {
      try {
        await idb.whenSynced;

        if (cancelled) return;

        try {
          const remote = await fetchSnapshotAndTail({ pageId, noteId, signal: abort.signal });

          if (cancelled) return;

          if (remote) {
            if (remote.snapshot.byteLength > 0) {
              Y.applyUpdateV2(newDoc, remote.snapshot);
            }
            for (const u of remote.updates) {
              Y.applyUpdateV2(newDoc, u.update);
            }
          }
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[strata-notepad] hydrate failed", err);
          }
        }
      } finally {
        if (!cancelled) {
          lastSentSVRef.current = Y.encodeStateVector(newDoc);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();

      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      try {
        const updateBytes = encodeUpdateSinceSV(newDoc, lastSentSVRef.current);

        if (updateBytes.byteLength > 0) {
          postUpdateBeacon({ pageId, noteId, update: updateBytes, clientId });
        }
      } catch {}

      void idb.destroy();
      newDoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return undefined;

    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === "remote-hydrate") return;
      scheduleFlush();
    };

    doc.on("update", onUpdate);

    return () => {
      doc.off("update", onUpdate);
    };
  }, [doc, ready, scheduleFlush]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => {
      try {
        const updateBytes = encodeUpdateSinceSV(doc, lastSentSVRef.current);

        if (updateBytes.byteLength === 0) return;
        const svBeforePost = Y.encodeStateVector(doc);

        if (postUpdateBeacon({ pageId, noteId, update: updateBytes, clientId })) {
          lastSentSVRef.current = svBeforePost;
        }
      } catch {}
    };

    window.addEventListener("pagehide", handler);

    return () => window.removeEventListener("pagehide", handler);
  }, [clientId, doc, noteId, pageId]);

  const markServerSeen = useCallback(() => {
    lastSentSVRef.current = Y.encodeStateVector(doc);
  }, [doc]);

  return {
    doc,
    ready,
    flushToServer,
    markServerSeen,
    clientId,
  };
}

/** Stable name of the Y.XmlFragment BlockNote should bind to inside the doc. */
export const STRATA_NOTEPAD_FRAGMENT = BLOCKNOTE_FRAGMENT_FIELD;
