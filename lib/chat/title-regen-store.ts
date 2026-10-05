"use client";

import { useSyncExternalStore } from "react";

export type TitleRegenSession = {
  baseTitle: string;
  nextTitle?: string;
};

type FinishListener = (threadId: string, nextTitle: string | undefined) => void;

const sessions = new Map<string, TitleRegenSession>();
const listeners = new Map<string, Set<() => void>>();

const EMPTY_SESSION: TitleRegenSession | null = null;

let finishListener: FinishListener | null = null;

function emit(threadId: string) {
  listeners.get(threadId)?.forEach((listener) => listener());
}

export function bindTitleRegenFinish(listener: FinishListener) {
  finishListener = listener;
}

export function startTitleRegen(threadId: string, baseTitle: string) {
  if (sessions.has(threadId)) return;

  sessions.set(threadId, { baseTitle: baseTitle.trim() || "Untitled chat" });
  emit(threadId);
}

export function publishTitleRegen(threadId: string, title: string) {
  const current = sessions.get(threadId);

  if (!current) return;

  const trimmed = title.trim() || "Chat";

  if (current.nextTitle === trimmed) return;

  sessions.set(threadId, { ...current, nextTitle: trimmed });
  emit(threadId);
}

export function completeTitleRegen(threadId: string) {
  const current = sessions.get(threadId);

  if (!current) return;

  sessions.delete(threadId);
  emit(threadId);
  finishListener?.(threadId, current.nextTitle);
}

export function hasTitleRegen(threadId: string) {
  return sessions.has(threadId);
}

export function getTitleRegenSession(threadId: string): TitleRegenSession | null {
  return sessions.get(threadId) ?? EMPTY_SESSION;
}

function subscribe(threadId: string | undefined, listener: () => void) {
  if (!threadId) return () => {};

  let bucket = listeners.get(threadId);

  if (!bucket) {
    bucket = new Set();
    listeners.set(threadId, bucket);
  }

  bucket.add(listener);

  return () => {
    bucket.delete(listener);
    if (bucket.size === 0) listeners.delete(threadId);
  };
}

/** Re-renders only the subscriber for this thread, not the chat tree. */
export function useTitleRegenSession(threadId: string | undefined): TitleRegenSession | null {
  return useSyncExternalStore(
    (listener) => subscribe(threadId, listener),
    () => (threadId ? getTitleRegenSession(threadId) : EMPTY_SESSION),
    () => EMPTY_SESSION
  );
}

export function resetTitleRegenStore() {
  const ids = [...sessions.keys(), ...listeners.keys()];

  sessions.clear();

  for (const id of ids) emit(id);
}
