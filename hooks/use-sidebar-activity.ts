"use client";

import type { SidebarThreadActivity } from "@/lib/sidebar/session-signal";

import { useCallback, useMemo } from "react";
import useSWR, { mutate as mutateGlobal } from "swr";

import { hasWorkingActivity } from "@/lib/sidebar/session-signal";
import {
  SESSION_ACTIVITY_FOCUS_THROTTLE_MS,
  SESSION_ACTIVITY_POLL_WORKING_MS,
} from "@/lib/sidebar/session-signal-timing";

/** SWR key for sidebar attention. Separate from the thread list: this one is polled. */
export const SIDEBAR_ACTIVITY_KEY = "/api/chats/activity";

type ActivityResponse = { data?: SidebarThreadActivity[] };

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
  };
}

/**
 * Sidebar attention, overlaid on the thread list. Polls only while something is working, and
 * revalidates on focus so seen state from other devices arrives. See
 * docs/thread-session-architecture.md for the contract.
 */
export function useSidebarActivity() {
  const { data, mutate } = useSWR<ActivityResponse>(SIDEBAR_ACTIVITY_KEY, activityFetcher, {
    refreshInterval: (latest) =>
      hasWorkingActivity(latest?.data) ? SESSION_ACTIVITY_POLL_WORKING_MS : 0,
    revalidateOnFocus: true,
    focusThrottleInterval: SESSION_ACTIVITY_FOCUS_THROTTLE_MS,
    revalidateOnReconnect: true,
    dedupingInterval: 2_000,
    // A failed poll must not retry on its own schedule; the next focus or navigation will.
    shouldRetryOnError: false,
  });

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
