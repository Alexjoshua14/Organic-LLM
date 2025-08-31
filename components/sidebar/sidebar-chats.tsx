"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@radix-ui/react-collapsible";
import { Pin, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SidebarGroup, SidebarGroupLabel } from "../third-party/ui/sidebar";

import { SidebarChatList } from "./sidebar-chat-list";

import { getChats } from "@/lib/chat/chat-store";
import { ThreadLink } from "@/types";
import { createLogger } from "@/lib/logger";

const logger = createLogger(`components/sidebar/sidebar-chats.tsx`);

declare global {
  interface Window {
    refreshSidebar: () => void;
  }
}

export const SidebarChats = () => {
  const [chats, setChats] = useState<ThreadLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    try {
      const res = await getChats();

      if (res.error) {
        logger.error(
          "fetchChats",
          `Error while fetching chats..`,
          res.error.message,
        );

        return;
      }

      const threads = res.data;

      if (threads === null) {
        setChats([]);

        return;
      }
      const normalizedChats: ThreadLink[] = threads.map((thread) => ({
        title: thread.title ?? "Unknown title",
        id: thread.id,
        pinned: thread.pinned ?? false,
        date: new Date(thread.updated_at).toISOString(),
      }));

      setChats(normalizedChats);
    } catch (error) {
      logger.error("fetchChats", `Error while fetching chats..`, error);
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* Fetch chats on mount */
  useEffect(() => {
    /** Expose fetchChats globally for other application components */
    window.refreshSidebar = fetchChats;

    /** Fetch chats */
    fetchChats();

    return () => {
      if ("refreshSidebar" in window) {
        delete (window as any).refreshSidebar;
      }
    };
  }, [fetchChats]);

  return (
    <>
      {chats.filter((t) => t.pinned).length > 0 && (
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <div className="flex items-end gap-1 text-foreground">
                  <Pin size={13} />
                  <h2>Pinned</h2>
                </div>
                <ChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarChatList threads={chats.filter((t) => t.pinned)} />
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      )}
      <SidebarGroup>
        <SidebarGroupLabel>
          <div className="text-foreground">
            <h2>All Threads</h2>
          </div>
        </SidebarGroupLabel>
        <SidebarChatList threads={chats.filter((t) => !t.pinned)} />
      </SidebarGroup>
    </>
  );
};
