"use client";

import type { KanbanActivity } from "@/components/chat/kanban/living/living-light";

import { useSyncExternalStore } from "react";

import { IDLE_ACTIVITY } from "@/components/chat/kanban/living/living-light";

/**
 * Ephemeral per-thread signal that the model is mid `kanban_board` tool call.
 * Not persisted — Presence uses it for the orb caption and attended underglow.
 */
let activities: Record<string, KanbanActivity> = {};
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function sameActivity(a: KanbanActivity, b: KanbanActivity): boolean {
  if (a.phase !== b.phase) return false;
  if (a.phase === "idle" || b.phase === "idle") return true;

  return a.command === b.command && a.targetId === b.targetId;
}

export function setKanbanActivity(threadId: string, activity: KanbanActivity): void {
  const prev = activities[threadId] ?? IDLE_ACTIVITY;

  if (sameActivity(prev, activity)) return;

  if (activity.phase === "idle") {
    if (!(threadId in activities)) return;
    const next = { ...activities };

    delete next[threadId];
    activities = next;
  } else {
    activities = { ...activities, [threadId]: activity };
  }
  emit();
}

export function getKanbanActivity(threadId: string): KanbanActivity {
  return activities[threadId] ?? IDLE_ACTIVITY;
}

export function clearKanbanActivity(threadId: string): void {
  setKanbanActivity(threadId, IDLE_ACTIVITY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** React hook: Presence orb / attended card while a tool call is in flight. */
export function useKanbanActivity(threadId: string): KanbanActivity {
  return useSyncExternalStore(
    subscribe,
    () => getKanbanActivity(threadId),
    () => IDLE_ACTIVITY
  );
}
