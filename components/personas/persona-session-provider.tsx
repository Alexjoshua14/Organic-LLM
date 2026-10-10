"use client";

import type { PaintingAnalysisOutcome } from "@/lib/personas/domains/acrylic/painting-state";
import type {
  PersonaReceipt,
  PersonaScopeId,
  PersonaSession,
  PersonaStarterId,
} from "@/lib/personas/unified/session";

import { useAuth } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { preparePaintingPhoto } from "@/lib/personas/domains/acrylic/painting-image";
import { findPersonaStarter } from "@/lib/personas/unified/registry";
import { PersonaScopeIdSchema, PersonaSessionSchema } from "@/lib/personas/unified/session";

/**
 * Client home of the unified persona: which session is on *for the current chat/Speak scope*,
 * chat receipts, and photo analysis. Lives in the root layout beside the voice provider so both
 * surfaces share project state (`latest`), but **active on/off is scoped** — enabling in chat A
 * does not force-enable in chat B. Nothing goes to browser storage; durable bits are server-side.
 */

export type PersonaPhotoStatus = {
  state: "idle" | "analyzing" | "done" | "error";
  message: string | null;
};

export type TimedReceipt = PersonaReceipt & { at: number };

type PersonaSessionContextValue = {
  session: PersonaSession | null;
  /** Chat/Speak scope currently bound; `null` means nowhere is on. */
  scopeId: PersonaScopeId | null;
  /** Bind on/off to this chat thread or Speak surface. Pass `null` on leave. */
  setScope: (scopeId: PersonaScopeId | null) => void;
  /** The first load finished for the current scope (signed out counts as finished). */
  ready: boolean;
  busy: boolean;
  error: string | null;
  photo: PersonaPhotoStatus;
  /** Chat receipts by user message id. */
  receipts: Readonly<Record<string, TimedReceipt>>;
  /** The newest receipt from any chat, for the composer's pulse. */
  lastReceipt: TimedReceipt | null;
  /** Changes whenever the session's subject or painting state does. */
  revision: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  chooseStarter: (starterId: PersonaStarterId) => Promise<void>;
  setSubject: (subject: string) => Promise<void>;
  startFresh: () => Promise<void>;
  analyzePhoto: (file: Blob, note?: string) => Promise<void>;
  recordReceipt: (receipt: PersonaReceipt) => void;
};

const PersonaSessionContext = createContext<PersonaSessionContextValue | null>(null);

async function readSession(response: Response): Promise<PersonaSession | null> {
  const body = (await response.json().catch(() => ({}))) as { session?: unknown; error?: unknown };

  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Something went wrong. Try again."
    );
  }
  if (body.session == null) return null;

  return PersonaSessionSchema.parse(body.session);
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const PHOTO_MESSAGES: Record<PaintingAnalysisOutcome, string> = {
  updated: "Got it — your assistant has the new photo.",
  unchanged: "No visible change since the last photo.",
  not_artwork: "That doesn't look like your painting, so nothing was saved. Chat can still see it.",
  poor_photo: "Too dark or blurry to read. Try even light, straight on.",
};

export function PersonaSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const [scopeId, setScopeIdState] = useState<PersonaScopeId | null>(null);
  const [session, setSession] = useState<PersonaSession | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PersonaPhotoStatus>({ state: "idle", message: null });
  const [receipts, setReceipts] = useState<Record<string, TimedReceipt>>({});
  const [lastReceipt, setLastReceipt] = useState<TimedReceipt | null>(null);
  const sessionRef = useRef<PersonaSession | null>(null);
  const scopeRef = useRef<PersonaScopeId | null>(null);
  /** The photo the current painting state came from, for the next difference image. */
  const previousPhotoRef = useRef<{ key: string; image: string | null } | null>(null);

  sessionRef.current = session;
  scopeRef.current = scopeId;

  const setScope = useCallback((next: PersonaScopeId | null) => {
    const parsed = next == null ? null : PersonaScopeIdSchema.safeParse(next);

    setScopeIdState(parsed && parsed.success ? parsed.data : null);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    setSession(null);
    setReceipts({});
    setLastReceipt(null);
    setError(null);
    if (!userId || !scopeId) {
      setReady(true);

      return;
    }

    setReady(false);
    const controller = new AbortController();
    const scoped = scopeId;

    fetch(`/api/personas/session?scopeId=${encodeURIComponent(scoped)}`, {
      signal: controller.signal,
    })
      .then(readSession)
      .then((next) => {
        if (scopeRef.current === scoped) setSession(next);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load your persona.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && scopeRef.current === scoped) setReady(true);
      });

    return () => controller.abort();
  }, [isLoaded, userId, scopeId]);

  const run = useCallback(async (task: () => Promise<PersonaSession | null>) => {
    setBusy(true);
    setError(null);
    try {
      setSession(await task());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const requireScope = useCallback((): PersonaScopeId => {
    const scoped = scopeRef.current;

    if (!scoped) throw new Error("Open a chat or Speak before switching a persona on.");

    return scoped;
  }, []);

  const enable = useCallback(
    () =>
      run(() => {
        const scoped = requireScope();

        return fetch(
          "/api/personas/session",
          jsonInit("POST", { personaId: "artist-assistant", mode: "resume", scopeId: scoped })
        ).then(readSession);
      }),
    [requireScope, run]
  );

  const disable = useCallback(async () => {
    const current = sessionRef.current;
    const scoped = scopeRef.current;

    if (!current || !scoped) {
      setSession(null);

      return;
    }
    await run(() =>
      fetch(
        "/api/personas/session",
        jsonInit("PATCH", { id: current.id, scopeId: scoped, active: false })
      ).then(readSession)
    );
  }, [run]);

  const startFresh = useCallback(
    () =>
      run(() => {
        const scoped = requireScope();

        return fetch(
          "/api/personas/session",
          jsonInit("POST", { personaId: "artist-assistant", mode: "new", scopeId: scoped })
        ).then(readSession);
      }),
    [requireScope, run]
  );

  /** A starter on an untouched session fills it in; on one with history it starts a new one. */
  const chooseStarter = useCallback(
    async (starterId: PersonaStarterId) => {
      const current = sessionRef.current;
      const scoped = requireScope();
      const starter = findPersonaStarter(starterId);

      if (!starter) return;
      const untouched = current && !current.work && current.log.length === 0;

      await run(() =>
        untouched
          ? fetch(
              "/api/personas/session",
              jsonInit("PATCH", { id: current.id, scopeId: scoped, starterId })
            ).then(readSession)
          : fetch(
              "/api/personas/session",
              jsonInit("POST", {
                personaId: "artist-assistant",
                mode: "new",
                scopeId: scoped,
                starterId,
              })
            ).then(readSession)
      );
    },
    [requireScope, run]
  );

  const setSubject = useCallback(
    async (subject: string) => {
      const current = sessionRef.current;
      const scoped = scopeRef.current;
      const trimmed = subject.trim();

      if (!current || !scoped || !trimmed) return;
      await run(() =>
        fetch(
          "/api/personas/session",
          jsonInit("PATCH", {
            id: current.id,
            scopeId: scoped,
            subject: trimmed,
            starterId: null,
          })
        ).then(readSession)
      );
    },
    [run]
  );

  const analyzePhoto = useCallback(async (file: Blob, note?: string) => {
    const current = sessionRef.current;

    if (!current) return;
    setPhoto({ state: "analyzing", message: "Reading your painting…" });
    try {
      const key = `${current.id}:${current.work?.revision ?? 0}`;
      let previous = previousPhotoRef.current?.key === key ? previousPhotoRef.current.image : null;

      if (current.work && previousPhotoRef.current?.key !== key) {
        const res = await fetch(`/api/personas/painting?personaSessionId=${current.id}`);

        previous = res.ok
          ? (((await res.json()) as { image?: string | null }).image ?? null)
          : null;
      }

      const prepared = await preparePaintingPhoto(file, current.work ? previous : null);
      const res = await fetch(
        "/api/personas/painting",
        jsonInit("POST", {
          personaSessionId: current.id,
          ...prepared,
          ...(note?.trim() ? { note: note.trim().slice(0, 500) } : {}),
        })
      );
      const body = (await res.json().catch(() => ({}))) as {
        session?: unknown;
        outcome?: PaintingAnalysisOutcome;
        error?: string;
      };

      if (!res.ok) throw new Error(body.error ?? "Could not read that photo. Try again.");
      const next = PersonaSessionSchema.parse(body.session);

      if (sessionRef.current?.id === next.id) {
        setSession(next);
        if (body.outcome === "updated" || body.outcome === "unchanged") {
          previousPhotoRef.current = {
            key: `${next.id}:${next.work?.revision ?? 0}`,
            image: prepared.currentImage,
          };
        }
      }
      setPhoto({
        state: "done",
        message: PHOTO_MESSAGES[body.outcome ?? "updated"],
      });
    } catch (cause) {
      setPhoto({
        state: "error",
        message: cause instanceof Error ? cause.message : "Could not read that photo. Try again.",
      });
    }
  }, []);

  const recordReceipt = useCallback((receipt: PersonaReceipt) => {
    const timed = { ...receipt, at: Date.now() };

    setLastReceipt(timed);
    if (receipt.messageId) {
      const id = receipt.messageId;

      setReceipts((prev) => ({ ...prev, [id]: timed }));
    }
  }, []);

  const revision = session ? `${session.id}:${session.updatedAt}` : null;

  const value = useMemo<PersonaSessionContextValue>(
    () => ({
      session,
      scopeId,
      setScope,
      ready,
      busy,
      error,
      photo,
      receipts,
      lastReceipt,
      revision,
      enable,
      disable,
      chooseStarter,
      setSubject,
      startFresh,
      analyzePhoto,
      recordReceipt,
    }),
    [
      session,
      scopeId,
      setScope,
      ready,
      busy,
      error,
      photo,
      receipts,
      lastReceipt,
      revision,
      enable,
      disable,
      chooseStarter,
      setSubject,
      startFresh,
      analyzePhoto,
      recordReceipt,
    ]
  );

  return <PersonaSessionContext.Provider value={value}>{children}</PersonaSessionContext.Provider>;
}

/** `null` outside the provider (tests, isolated sandboxes). */
export function usePersonaSessionOptional() {
  return useContext(PersonaSessionContext);
}

/**
 * Bind the persona on/off flag to this chat/Speak scope for as long as the caller is mounted.
 * Clearing on unmount keeps the persona from leaking into the next page.
 */
export function usePersonaScope(scopeId: PersonaScopeId | null | undefined) {
  const persona = usePersonaSessionOptional();
  const setScope = persona?.setScope;

  useEffect(() => {
    if (!setScope) return;
    setScope(scopeId ?? null);

    return () => setScope(null);
  }, [setScope, scopeId]);
}
