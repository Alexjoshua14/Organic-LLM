"use client";

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@radix-ui/react-collapsible";
import { Pin, ChevronUp } from "lucide-react";
import { useMemo } from "react";

import { SidebarGroup, SidebarGroupLabel } from "../third-party/ui/sidebar";

import { SidebarChatList } from "./sidebar-chat-list";

import { useSharedChatContext } from "@/lib/context/chat-context";

/**
 * Renders the sidebar chat list (pinned + all threads). Data is owned by
 * ChatProvider and loaded via SWR on app mount, so the list is available
 * even when the sidebar starts collapsed.
 */
export const SidebarChats = () => {
  const { sidebarChats: chats, isSidebarChatsLoading } = useSharedChatContext();

  const pinnedChats = useMemo(() => chats.filter((t) => t.pinned), [chats]);
  const allChats = useMemo(() => chats.filter((t) => !t.pinned), [chats]);

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

  if (isSidebarChatsLoading && chats.length === 0) {
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
      </SidebarGroup>
    </div>
  );
};
