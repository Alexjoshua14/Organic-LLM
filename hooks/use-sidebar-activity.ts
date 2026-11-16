"use client";

import type { GeneratingRabbitHole, SidebarThreadActivity } from "@/lib/sidebar/session-signal";

import { useCallback, useMemo } from "react";
import useSWR, { mutate as mutateGlobal } from "swr";

import { hasWorkingActivity } from "@/lib/sidebar/session-signal";
import {
  SESSION_ACTIVITY_FOCUS_THROTTLE_MS,
  SESSION_ACTIVITY_POLL_WORKING_MS,
} from "@/lib/sidebar/session-signal-timing";

/** SWR key for sidebar attention. Separate from the thread list: this one is polled. */
export const SIDEBAR_ACTIVITY_KEY = "/api/chats/activity";

export type ActivityResponse = {
  data?: SidebarThreadActivity[];
  rabbitHoles?: GeneratingRabbitHole[];
};

/** Anything producing content: a working thread row, or a rabbit hole generating by session. */
export function isWorking(latest: ActivityResponse | undefined): boolean {
  return hasWorkingActivity(latest?.data) || (latest?.rabbitHoles?.length ?? 0) > 0;
}

/**
 * One config for every subscriber to the activity key, so the sidebar and any number of
 * rabbit-hole creation cards share one poll (SWR dedupes by key), and it only runs while
 * something is working.
 */
const ACTIVITY_SWR_CONFIG = {
  refreshInterval: (latest: ActivityResponse | undefined) =>
    isWorking(latest) ? SESSION_ACTIVITY_POLL_WORKING_MS : 0,
  revalidateOnFocus: true,
  focusThrottleInterval: SESSION_ACTIVITY_FOCUS_THROTTLE_MS,
  revalidateOnReconnect: true,
  dedupingInterval: 2_000,
  // A failed poll must not retry on its own schedule; the next focus or navigation will.
  shouldRetryOnError: false,
};

/**
 * Ask the sidebar to re-check attention now. Call where this client starts or finishes work
 * (a reply begins streaming, a rabbit-hole node starts generating) — otherwise the sidebar only
 * looks on navigation and focus, and would miss work started on the current page.
 */
export function nudgeSidebarActivity() {
  void mutateGlobal(SIDEBAR_ACTIVITY_KEY);
}

async function activityFetcher(url: string): Promise<ActivityResponse> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch sidebar activity (${res.status})`);
  }

  return res.json();
}

/** Clears `unseen` locally; rows left with nothing to show are dropped, as the server would. */
function withoutUnseen(
  current: ActivityResponse | undefined,
  threadId: string
): ActivityResponse | undefined {
  if (!current?.data) return current;

  return {
    data: current.data
      .map((row) => (row.id === threadId ? { ...row, unseen: false } : row))
      .filter((row) => row.unseen || row.working),
    rabbitHoles: current.rabbitHoles,
  };
}

/**
 * Sidebar attention, overlaid on the thread list. Polls only while something is working, and
 * revalidates on focus so seen state from other devices arrives. See
 * docs/thread-session-architecture.md for the contract.
 */
export function useSidebarActivity() {
  const { data, mutate } = useSWR<ActivityResponse>(
    SIDEBAR_ACTIVITY_KEY,
    activityFetcher,
    ACTIVITY_SWR_CONFIG
  );

  const activityById = useMemo(() => {
    const map = new Map<string, SidebarThreadActivity>();

    for (const row of data?.data ?? []) map.set(row.id, row);

    return map;
  }, [data?.data]);

  const revalidateActivity = useCallback(() => {
    void mutate();
  }, [mutate]);

  /** Optimistic: the signal clears at once, then the server confirms (or we resync). */
  const markSeen = useCallback(
    async (threadId: string) => {
      await mutate((current) => withoutUnseen(current, threadId), { revalidate: false });

      const res = await fetch(`/api/chats/${encodeURIComponent(threadId)}/seen`, {
        method: "POST",
      }).catch(() => null);

      if (!res?.ok) void mutate();
    },
    [mutate]
  );

  return { activityById, markSeen, revalidateActivity };
}

export type RabbitHoleGenerationFeed = {
  /** The shared activity response has arrived at least once. */
  loaded: boolean;
  /** This session's generating node and step, or null when it is not generating. */
  entry: GeneratingRabbitHole | null;
};

/**
 * Whether one rabbit hole is generating, read from the shared activity poll: no poller of its
 * own. Pass `null` to stay unsubscribed. Mounting a subscriber starts the shared poll if the
 * sidebar has not (it only repeats while something is working).
 */
export function useRabbitHoleGeneration(sessionId: string | null): RabbitHoleGenerationFeed {
  const { data, error } = useSWR<ActivityResponse>(
    sessionId ? SIDEBAR_ACTIVITY_KEY : null,
    activityFetcher,
    ACTIVITY_SWR_CONFIG
  );

  return {
    // A failed poll still counts: the card falls back to one direct status read.
    loaded: data !== undefined || error !== undefined,
    entry: data?.rabbitHoles?.find((row) => row.sessionId === sessionId) ?? null,
  };
}
