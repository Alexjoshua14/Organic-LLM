"use client";

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@radix-ui/react-collapsible";
import { Pin, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { SidebarGroup, SidebarGroupLabel } from "../third-party/ui/sidebar";

import { SidebarChatList } from "./sidebar-chat-list";

import { useSharedChatContext } from "@/lib/context/chat-context";

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
    sidebarPinnedChats: pinnedChats,
    sidebarUnpinnedChats: allChats,
    isSidebarChatsLoading,
    isSidebarChatsLoadingMore,
    hasMoreSidebarChats,
    loadMoreSidebarChats,
  } = useSharedChatContext();
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  const allChatsComponents = useMemo(() => {
    return allChats.length > 0 ? <SidebarChatList threads={allChats} /> : null;
  }, [allChats]);

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
            <SidebarChatList threads={pinnedChats} />
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    ) : null;
  }, [pinnedChats]);

  if (isSidebarChatsLoading && pinnedChats.length === 0 && allChats.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Loading threads…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1">
      {pinnedChatsComponents}
      <SidebarGroup className="shrink-0">
        <SidebarGroupLabel>
          <div className="text-foreground">
            <h2>All Threads</h2>
          </div>
        </SidebarGroupLabel>
        {allChatsComponents}
        {hasMoreSidebarChats && <div ref={loadMoreRef} aria-hidden="true" className="h-px" />}
        {isSidebarChatsLoadingMore && (
          <div className="py-2 text-center text-muted-foreground text-xs">
            Loading older threads…
          </div>
        )}
      </SidebarGroup>
    </div>
  );
};
