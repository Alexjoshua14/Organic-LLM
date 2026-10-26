"use client";

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@radix-ui/react-collapsible";
import { Pin, ChevronUp } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { SidebarGroup, SidebarGroupLabel } from "../third-party/ui/sidebar";

import { SidebarAttentionSummary } from "./sidebar-attention-summary";
import { SidebarChatList } from "./sidebar-chat-list";
import { SidebarChatsSkeleton, SidebarThreadRowsSkeleton } from "./sidebar-chats-skeleton";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { useChatId } from "@/hooks/use-chat-id";
import { useSidebarActivity } from "@/hooks/use-sidebar-activity";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { getSessionExperience } from "@/lib/sidebar/session-experience";
import {
  deriveSessionSignal,
  resolveActiveThreadId,
  summarizeSessionSignals,
  type SessionSignal,
} from "@/lib/sidebar/session-signal";

/** Start the next page this far before the end of the list is visible. */
const LOAD_MORE_ROOT_MARGIN = "400px";

/**
 * Renders the sidebar chat list (pinned + all threads). Data is owned by
 * ChatProvider and loaded via SWR on app mount, so the list is available
 * even when the sidebar starts collapsed. The server filters by scope
 * (coalescence mode) and pages older threads in as the list scrolls.
 */
export const SidebarChats = () => {
  const {
    refreshSidebarChats,
    sidebarPinnedChats: pinnedChats,
    sidebarUnpinnedChats: allChats,
    isSidebarChatsLoading,
    isSidebarChatsLoadingMore,
    hasMoreSidebarChats,
    loadMoreSidebarChats,
  } = useSharedChatContext();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filteredChats = useMemo(() => [...pinnedChats, ...allChats], [pinnedChats, allChats]);

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !hasMoreSidebarChats || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreSidebarChats();
      },
      // rootMargin only applies to the root, so observe within the sidebar's scroller.
      { root: node.closest('[data-sidebar="content"]'), rootMargin: LOAD_MORE_ROOT_MARGIN }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [hasMoreSidebarChats, loadMoreSidebarChats]);

  // ── Session signals: what each row tells the user without being opened ──
  const { activityById, markSeen, revalidateActivity } = useSidebarActivity();
  const voice = useVoiceSessionOptional();
  const pathChatId = useChatId();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const pageVisible = usePageVisible();

  const activeThreadId = useMemo(
    () => resolveActiveThreadId(filteredChats, { chatId: pathChatId, pathname, search }),
    [filteredChats, pathChatId, pathname, search]
  );

  const voiceThreadId = voice?.threadId ?? null;
  const voiceLive = Boolean(voice?.connected || voice?.connecting);
  const voicePaused = Boolean(voice?.paused);

  const signals = useMemo(() => {
    const voiceInput = voice
      ? { threadId: voiceThreadId, live: voiceLive, paused: voicePaused }
      : null;
    const map = new Map<string, SessionSignal>();

    for (const thread of filteredChats) {
      map.set(
        thread.id,
        deriveSessionSignal({
          threadId: thread.id,
          experience: getSessionExperience(thread.feature),
          activity: activityById.get(thread.id),
          voice: voiceInput,
          isActive: thread.id === activeThreadId,
        })
      );
    }

    return map;
  }, [filteredChats, activityById, activeThreadId, voice, voiceThreadId, voiceLive, voicePaused]);

  const summary = useMemo(() => summarizeSessionSignals(signals.values()), [signals]);

  // The open thread in a visible tab is being seen: clear its "new" on every device.
  const activeUnseen = activeThreadId ? activityById.get(activeThreadId)?.unseen === true : false;

  useEffect(() => {
    if (!activeThreadId || !pageVisible || !activeUnseen) return;
    void markSeen(activeThreadId);
  }, [activeThreadId, activeUnseen, pageVisible, markSeen]);

  // Leaving a page may leave work running behind it; look once on every navigation.
  useEffect(() => {
    revalidateActivity();
  }, [pathname, search, revalidateActivity]);

  // When work finishes, titles and order may have changed server-side; refresh the list once.
  const workingKey = useMemo(
    () =>
      [...activityById.values()]
        .filter((row) => row.working)
        .map((row) => row.id)
        .sort()
        .join(","),
    [activityById]
  );
  const previousWorkingRef = useRef<string>("");

  useEffect(() => {
    const previous = previousWorkingRef.current;

    previousWorkingRef.current = workingKey;
    if (!previous) return;

    const current = new Set(workingKey.split(","));

    if (previous.split(",").some((id) => !current.has(id))) refreshSidebarChats();
  }, [workingKey, refreshSidebarChats]);

  const listRef = useRef<HTMLDivElement>(null);
  const jumpCursorRef = useRef(-1);

  /** Cycles focus through rows holding new content, scrolling each into view. */
  const jumpToNextNew = useCallback(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>(
      '[data-session-signal="new"] [data-sidebar-thread-open]'
    );

    if (!rows || rows.length === 0) return;

    jumpCursorRef.current = (jumpCursorRef.current + 1) % rows.length;
    const target = rows[jumpCursorRef.current];
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    target.scrollIntoView?.({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    target.focus({ preventScroll: true });
  }, []);

  const allChatsComponents = useMemo(() => {
    return allChats.length > 0 ? (
      <SidebarChatList activeThreadId={activeThreadId} signals={signals} threads={allChats} />
    ) : null;
  }, [allChats, activeThreadId, signals]);

  const pinnedChatsComponents = useMemo(() => {
    return pinnedChats.length > 0 ? (
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger>
              <div className="flex items-end gap-1 text-foreground">
                <Pin size={13} />
                <h2>Pinned</h2>
              </div>
              <ChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180 cursor-pointer hover:scale-110" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarChatList
              activeThreadId={activeThreadId}
              signals={signals}
              threads={pinnedChats}
            />
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    ) : null;
  }, [pinnedChats, activeThreadId, signals]);

  if (isSidebarChatsLoading && pinnedChats.length === 0 && allChats.length === 0) {
    return <SidebarChatsSkeleton />;
  }

  return (
    <div ref={listRef} className="flex flex-col gap-1 py-1">
      {pinnedChatsComponents}
      <SidebarGroup className="shrink-0">
        <SidebarGroupLabel>
          <div className="text-foreground">
            <h2>All Threads</h2>
          </div>
          <SidebarAttentionSummary
            unseen={summary.unseen}
            working={summary.working}
            onJumpToNew={jumpToNextNew}
          />
        </SidebarGroupLabel>
        {allChatsComponents}
        {hasMoreSidebarChats && <div ref={loadMoreRef} aria-hidden="true" className="h-px" />}
        {isSidebarChatsLoadingMore && <SidebarThreadRowsSkeleton rows={3} />}
      </SidebarGroup>
    </div>
  );
};
